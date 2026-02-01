import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const configSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().transform(Number).default("3000"),

  DATABASE_URL: z.string(),

  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.string().transform(Number).default("6379"),
  REDIS_PASSWORD: z.string().optional(),

  API_RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default("900000"),
  API_RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default("100"),

  SPORTMONKS_API_KEY: z.string().optional(),
  SPORTMONKS_API_BASE: z.string().default("https://api.sportmonks.com/v3"),
  SPORTMONKS_RATE_LIMIT_DELAY: z.string().transform(Number).default("2000"),

  ODDS_API_KEY: z.string().optional(),
  ODDS_API_BASE: z.string().default("https://api.the-odds-api.com/v4"),

  DATA_FETCH_CRON: z.string().default("0 9 * * 5"),

  MIN_CONFIDENCE_THRESHOLD: z.string().transform(Number).default("60"),
  FORM_WEIGHT: z.string().transform(Number).default("0.30"),
  HOME_AWAY_WEIGHT: z.string().transform(Number).default("0.25"),
  HEAD_TO_HEAD_WEIGHT: z.string().transform(Number).default("0.20"),
  INJURY_WEIGHT: z.string().transform(Number).default("0.15"),
  LEAGUE_POSITION_WEIGHT: z.string().transform(Number).default("0.10"),

  LOG_LEVEL: z.string().default("info"),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  try {
    return configSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Invalid configuration:");
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
}

export const config = loadConfig();
