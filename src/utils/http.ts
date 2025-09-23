import axios from 'axios';
import Bottleneck from 'bottleneck';
import fs from 'fs-extra';
import path from 'path';
import dayjs from 'dayjs';

// Create rate limiter for API requests
const limiter = new Bottleneck({
  minTime: process.env.RATE_LIMIT_MS ? parseInt(process.env.RATE_LIMIT_MS) : 400, // Default: ~2.5 req/sec
  maxConcurrent: 1 // Only process one request at a time
});

// Default headers for requests
const defaultHeaders = {
  'User-Agent': process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'max-age=0'
};

/**
 * Fetch HTML content from a URL with rate limiting
 * @param url The URL to fetch
 * @param options Additional axios request options
 * @returns The HTML content as string
 */
export async function fetchHtml(url: string, options: any = {}): Promise<string> {
  const fetchWithRetry = async (retries = 3): Promise<string> => {
    try {
      const response = await axios.get(url, {
        headers: { ...defaultHeaders, ...(options.headers || {}) },
        timeout: options.timeout || 30000,
        ...options
      });
      return response.data;
    } catch (error: any) {
      if (retries > 0 && (error.response?.status >= 500 || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT')) {
        console.warn(`Request to ${url} failed, retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
        return fetchWithRetry(retries - 1);
      }
      throw error;
    }
  };

  return limiter.schedule(() => fetchWithRetry());
}

/**
 * Save HTML content to a file for offline use
 * @param html The HTML content
 * @param name The name of the file (without extension)
 * @param date The date to organize files (YYYY-MM-DD)
 */
export async function saveHtmlToFile(html: string, name: string, date: string): Promise<void> {
  const dateFolder = path.join(__dirname, '../../data/raw', date.replace(/-/g, ''));
  fs.ensureDirSync(dateFolder);
  
  const filePath = path.join(dateFolder, `${name}.html`);
  await fs.writeFile(filePath, html, 'utf-8');
}

/**
 * Load HTML content from a file
 * @param name The name of the file (without extension)
 * @param date The date to organize files (YYYY-MM-DD)
 * @returns The HTML content as string
 */
export async function loadHtmlFromFile(name: string, date: string): Promise<string> {
  const dateFolder = path.join(__dirname, '../../data/raw', date.replace(/-/g, ''));
  const filePath = path.join(dateFolder, `${name}.html`);
  
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`Could not find saved HTML file: ${filePath}`);
  }
}

/**
 * Check if a URL is allowed by robots.txt
 * @param url The URL to check
 * @returns A boolean indicating if the URL is allowed
 */
export async function isUrlAllowed(url: string): Promise<boolean> {
  // For simplicity, we'll assume all URLs are allowed in this example
  // In a real application, you would parse robots.txt and check rules
  return true;
}