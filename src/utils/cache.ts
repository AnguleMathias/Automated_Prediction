import Redis from "ioredis";
import { config } from "../config";
import { logger } from "./logger";

class CacheService {
  private client: Redis | null = null;
  private isEnabled: boolean = true;

  constructor() {
    try {
      this.client = new Redis({
        host: config.REDIS_HOST,
        port: config.REDIS_PORT,
        password: config.REDIS_PASSWORD,
        retryStrategy: (times) => {
          if (times > 3) {
            logger.warn("Redis connection failed, disabling cache");
            this.isEnabled = false;
            return null;
          }
          return Math.min(times * 200, 2000);
        },
      });

      this.client.on("error", (err) => {
        logger.error({ err }, "Redis error");
        this.isEnabled = false;
      });

      this.client.on("connect", () => {
        logger.info("Redis connected");
        this.isEnabled = true;
      });
    } catch (error) {
      logger.warn("Redis not available, cache disabled");
      this.isEnabled = false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isEnabled || !this.client) return null;

    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error({ error, key }, "Cache get error");
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    if (!this.isEnabled || !this.client) return;

    try {
      await this.client.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      logger.error({ error, key }, "Cache set error");
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.isEnabled || !this.client) return;

    try {
      await this.client.del(key);
    } catch (error) {
      logger.error({ error, key }, "Cache delete error");
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    if (!this.isEnabled || !this.client) return;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      logger.error({ error, pattern }, "Cache delete pattern error");
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }
}

export const cache = new CacheService();
