import puppeteer from 'puppeteer';
import dayjs from 'dayjs';
import { fetchHtml, saveHtmlToFile, loadHtmlFromFile } from '../utils/http';
import { scheduleRequest } from '../utils/rateLimiter';

// Interfaces
interface FlashscoreMatch {
  id: string;
  league: string;
  country: string;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  kickoff_timestamp: number;
  status?: string;
  home_score?: number;
  away_score?: number;
  home_form?: string[];
  away_form?: string[];
  h2h_matches?: any[];
  raw_data?: any;
}

/**
 * Scrape match data from Flashscore for a specific date
 * @param date Date to scrape in YYYY-MM-DD format
 * @param useOffline Whether to use offline stored HTML
 * @returns Array of match data
 */
export async function scrapeFlashscore(date: string, useOffline = false): Promise<FlashscoreMatch[]> {
  console.log(`Scraping Flashscore for ${date}...`);
  
  const dateFormatted = dayjs(date).format('YYYYMMDD');
  const url = `https://www.flashscore.com/football/?d=${dateFormatted}`;
  
  let html = '';
  
  if (useOffline) {
    try {
      html = await loadHtmlFromFile('flashscore', date);
      console.log('Using offline Flashscore data');
    } catch (error) {
      console.error('Could not load offline Flashscore data:', error);
      throw new Error('Offline data requested but not available');
    }
  } else {
    // Flashscore requires JavaScript, so we use Puppeteer
    console.log('Launching browser to scrape Flashscore...');
    
    const browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      
      // Set viewport and user agent
      await page.setViewport({ width: 1366, height: 768 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Schedule the request using our rate limiter
      await scheduleRequest(url, async () => {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Wait for the matches to load
        await page.waitForSelector('.event__match', { timeout: 30000 });
        
        // Accept cookies if the dialog appears
        try {
          const cookieButton = await page.$('.fc-cta-consent');
          if (cookieButton) {
            await cookieButton.click();
            await page.waitForTimeout(1000);
          }
        } catch (error) {
          // Cookie dialog might not appear, so we can ignore this error
        }
        
        // Scroll down to load all matches
        await autoScroll(page);
        
        // Get the HTML
        html = await page.content();
        
        // Save HTML for offline use
        await saveHtmlToFile(html, 'flashscore', date);
      });
    } finally {
      await browser.close();
    }
  }
  
  // Parse the HTML to extract match data
  return parseFlashscoreHtml(html, date);
}

/**
 * Parse Flashscore HTML to extract match data
 * @param html HTML content from Flashscore
 * @param date Date in YYYY-MM-DD format
 * @returns Array of match data
 */
function parseFlashscoreHtml(html: string, date: string): FlashscoreMatch[] {
  const matches: FlashscoreMatch[] = [];
  
  // In a real implementation, we would use cheerio or puppeteer's evaluate to parse the HTML
  // For brevity, here's a simplified example:
  
  // Example implementation using regular expressions (not ideal but simplified for this example)
  const matchRegex = /<div[^>]*class="[^"]*event__match[^"]*"[^>]*data-id="([^"]+)"[^>]*>([\s\S]*?)<\/div>/g;
  const leagueRegex = /<div[^>]*class="[^"]*event__header[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
  
  let match;
  let currentLeague = { name: 'Unknown', country: 'Unknown' };
  
  // Extract leagues
  while ((match = leagueRegex.exec(html)) !== null) {
    const leagueBlock = match[1];
    const leagueNameMatch = /<div[^>]*class="[^"]*event__title[^"]*"[^>]*>([\s\S]*?)<\/div>/g.exec(leagueBlock);
    const countryMatch = /<div[^>]*class="[^"]*event__title--type[^"]*"[^>]*>([\s\S]*?)<\/div>/g.exec(leagueBlock);
    
    if (leagueNameMatch) {
      currentLeague.name = leagueNameMatch[1].trim();
    }
    
    if (countryMatch) {
      currentLeague.country = countryMatch[1].trim();
    }
  }
  
  // Extract matches
  while ((match = matchRegex.exec(html)) !== null) {
    const matchId = match[1];
    const matchBlock = match[2];
    
    const homeTeamMatch = /<div[^>]*class="[^"]*event__participant--home[^"]*"[^>]*>([\s\S]*?)<\/div>/g.exec(matchBlock);
    const awayTeamMatch = /<div[^>]*class="[^"]*event__participant--away[^"]*"[^>]*>([\s\S]*?)<\/div>/g.exec(matchBlock);
    const timeMatch = /<div[^>]*class="[^"]*event__time[^"]*"[^>]*>([\s\S]*?)<\/div>/g.exec(matchBlock);
    
    if (homeTeamMatch && awayTeamMatch && timeMatch) {
      const homeTeam = homeTeamMatch[1].trim();
      const awayTeam = awayTeamMatch[1].trim();
      const timeStr = timeMatch[1].trim();
      
      // Parse time (simplified)
      const timeRegex = /(\d{2}):(\d{2})/;
      const timeMatch = timeStr.match(timeRegex);
      let kickoffTime = '';
      let kickoffTimestamp = 0;
      
      if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        
        // Create timestamp
        const kickoffDate = dayjs(date).hour(hours).minute(minutes).second(0);
        kickoffTime = kickoffDate.format('YYYY-MM-DD HH:mm:ss');
        kickoffTimestamp = kickoffDate.unix();
      }
      
      matches.push({
        id: matchId,
        league: currentLeague.name,
        country: currentLeague.country,
        home_team: homeTeam,
        away_team: awayTeam,
        kickoff_time: kickoffTime,
        kickoff_timestamp: kickoffTimestamp
      });
    }
  }
  
  return matches;
}

/**
 * Auto-scroll function for Puppeteer to load all dynamic content
 * @param page Puppeteer page object
 */
async function autoScroll(page: any): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}