import Bottleneck from 'bottleneck';
import { EventEmitter } from 'events';

// Extend the event emitter limit for large scale operations
EventEmitter.defaultMaxListeners = 100;

/**
 * Create domain-specific rate limiters to avoid IP bans
 */
const rateLimiters: { [domain: string]: Bottleneck } = {
  // Flashscore rate limiter - more conservative as they have stricter protection
  'flashscore': new Bottleneck({
    minTime: 2000, // 1 request every 2 seconds
    maxConcurrent: 1,
    highWater: 5,
    strategy: Bottleneck.strategy.LEAK
  }),
  
  // Soccervista rate limiter
  'soccervista': new Bottleneck({
    minTime: 1000, // 1 request every second
    maxConcurrent: 1,
    highWater: 10,
    strategy: Bottleneck.strategy.LEAK
  }),
  
  // Freesupertips rate limiter
  'freesupertips': new Bottleneck({
    minTime: 1000, // 1 request every second
    maxConcurrent: 1,
    highWater: 10,
    strategy: Bottleneck.strategy.LEAK
  }),
  
  // Bookmaker rate limiters
  'mozzart': new Bottleneck({
    minTime: 1500, // 1 request every 1.5 seconds
    maxConcurrent: 1,
    highWater: 5,
    strategy: Bottleneck.strategy.LEAK
  }),
  
  'betika': new Bottleneck({
    minTime: 1500, // 1 request every 1.5 seconds
    maxConcurrent: 1,
    highWater: 5,
    strategy: Bottleneck.strategy.LEAK
  }),
  
  'sportpesa': new Bottleneck({
    minTime: 1500, // 1 request every 1.5 seconds
    maxConcurrent: 1,
    highWater: 5, 
    strategy: Bottleneck.strategy.LEAK
  }),
  
  // Default rate limiter for any other domain
  'default': new Bottleneck({
    minTime: 1000, // 1 request every second
    maxConcurrent: 1,
    highWater: 10,
    strategy: Bottleneck.strategy.LEAK
  })
};

/**
 * Get the appropriate rate limiter for a domain
 * @param url The URL to get a rate limiter for
 * @returns A Bottleneck rate limiter instance
 */
export function getRateLimiter(url: string): Bottleneck {
  let domain = 'default';
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // Match domain to the appropriate limiter
    if (hostname.includes('flashscore')) {
      domain = 'flashscore';
    } else if (hostname.includes('soccervista')) {
      domain = 'soccervista';
    } else if (hostname.includes('freesupertips')) {
      domain = 'freesupertips';
    } else if (hostname.includes('mozzart')) {
      domain = 'mozzart';
    } else if (hostname.includes('betika')) {
      domain = 'betika';
    } else if (hostname.includes('sportpesa')) {
      domain = 'sportpesa';
    }
  } catch (error) {
    console.warn(`Invalid URL provided: ${url}. Using default rate limiter.`);
  }
  
  return rateLimiters[domain];
}

/**
 * Schedule a function to run with the appropriate rate limiter
 * @param url The URL to determine which rate limiter to use
 * @param fn The function to schedule
 * @returns The result of the scheduled function
 */
export async function scheduleRequest<T>(url: string, fn: () => Promise<T>): Promise<T> {
  const limiter = getRateLimiter(url);
  return limiter.schedule(fn);
}