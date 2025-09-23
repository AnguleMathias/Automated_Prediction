import * as cheerio from 'cheerio';
import dayjs from 'dayjs';
import { fetchHtml, saveHtmlToFile, loadHtmlFromFile } from '../../utils/http';
import { scheduleRequest } from '../../utils/rateLimiter';

// Interfaces
interface MozzartOdds {
  id: string;
  home_team: string;
  away_team: string;
  match_time: string;
  match_timestamp: number;
  league: string;
  home_win_odds: number;
  draw_odds: number;
  away_win_odds: number;
  btts_yes_odds?: number;
  btts_no_odds?: number;
  over_2_5_odds?: number;
  under_2_5_odds?: number;
  raw_data?: any;
}

/**
 * Scrape odds data from Mozzart for a specific date
 * @param date Date to scrape in YYYY-MM-DD format
 * @param useOffline Whether to use offline stored HTML
 * @returns Array of odds data
 */
export async function scrapeMozzartOdds(date: string, useOffline = false): Promise<MozzartOdds[]> {
  console.log(`Scraping Mozzart odds for ${date}...`);
  
  const dateFormatted = dayjs(date).format('DD.MM.YYYY');
  const url = `https://www.mozzartbet.co.ke/en/offer/date/${dateFormatted}`;
  
  let html = '';
  
  if (useOffline) {
    try {
      html = await loadHtmlFromFile('mozzart', date);
      console.log('Using offline Mozzart data');
    } catch (error) {
      console.error('Could not load offline Mozzart data:', error);
      throw new Error('Offline data requested but not available');
    }
  } else {
    // Mozzart can be scraped with a simple HTTP request
    await scheduleRequest(url, async () => {
      html = await fetchHtml(url);
      await saveHtmlToFile(html, 'mozzart', date);
    });
  }
  
  // Parse the HTML to extract odds data
  return parseMozzartHtml(html, date);
}

/**
 * Parse Mozzart HTML to extract odds data
 * @param html HTML content from Mozzart
 * @param date Date in YYYY-MM-DD format
 * @returns Array of odds data
 */
function parseMozzartHtml(html: string, date: string): MozzartOdds[] {
  const odds: MozzartOdds[] = [];
  const $ = cheerio.load(html);
  
  // Find all match containers
  $('.bet-match').each((_, matchElem) => {
    try {
      const leagueElem = $(matchElem).closest('.bet-sport-subcategory');
      const leagueName = leagueElem.find('.bet-sport-subcategory-header').text().trim();
      
      const timeElem = $(matchElem).find('.bet-match-time');
      const timeStr = timeElem.text().trim();
      
      const teamsElem = $(matchElem).find('.bet-match-name');
      const teamsStr = teamsElem.text().trim();
      
      // Parse teams
      const teamsSplit = teamsStr.split(' - ');
      if (teamsSplit.length !== 2) return;
      
      const homeTeam = teamsSplit[0].trim();
      const awayTeam = teamsSplit[1].trim();
      
      // Parse time
      const timeRegex = /(\d{2}):(\d{2})/;
      const timeMatch = timeStr.match(timeRegex);
      let matchTime = '';
      let matchTimestamp = 0;
      
      if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        
        // Create timestamp
        const matchDate = dayjs(date).hour(hours).minute(minutes).second(0);
        matchTime = matchDate.format('YYYY-MM-DD HH:mm:ss');
        matchTimestamp = matchDate.unix();
      }
      
      // Find all betting odds
      const oddsElems = $(matchElem).find('.bet-match-odd');
      
      let homeWinOdds = 0;
      let drawOdds = 0;
      let awayWinOdds = 0;
      let bttsYesOdds: number | undefined;
      let bttsNoOdds: number | undefined;
      let over25Odds: number | undefined;
      let under25Odds: number | undefined;
      
      // Extract 1X2 odds
      const mainOddsContainer = $(matchElem).find('.bet-match-odds-group[data-group-id="1"]');
      
      if (mainOddsContainer.length) {
        const homeOddElem = mainOddsContainer.find('.bet-match-odd[data-type="1"]');
        const drawOddElem = mainOddsContainer.find('.bet-match-odd[data-type="X"]');
        const awayOddElem = mainOddsContainer.find('.bet-match-odd[data-type="2"]');
        
        homeWinOdds = parseFloat(homeOddElem.find('.bet-match-odd-value').text().trim()) || 0;
        drawOdds = parseFloat(drawOddElem.find('.bet-match-odd-value').text().trim()) || 0;
        awayWinOdds = parseFloat(awayOddElem.find('.bet-match-odd-value').text().trim()) || 0;
      }
      
      // Extract BTTS odds
      const bttsContainer = $(matchElem).find('.bet-match-odds-group[data-group-id="4"]');
      
      if (bttsContainer.length) {
        const bttsYesElem = bttsContainer.find('.bet-match-odd[data-type="GG"]');
        const bttsNoElem = bttsContainer.find('.bet-match-odd[data-type="NG"]');
        
        if (bttsYesElem.length) {
          bttsYesOdds = parseFloat(bttsYesElem.find('.bet-match-odd-value').text().trim()) || undefined;
        }
        
        if (bttsNoElem.length) {
          bttsNoOdds = parseFloat(bttsNoElem.find('.bet-match-odd-value').text().trim()) || undefined;
        }
      }
      
      // Extract over/under odds
      const ouContainer = $(matchElem).find('.bet-match-odds-group[data-group-id="2"]');
      
      if (ouContainer.length) {
        const overElem = ouContainer.find('.bet-match-odd[data-type="Over 2.5"]');
        const underElem = ouContainer.find('.bet-match-odd[data-type="Under 2.5"]');
        
        if (overElem.length) {
          over25Odds = parseFloat(overElem.find('.bet-match-odd-value').text().trim()) || undefined;
        }
        
        if (underElem.length) {
          under25Odds = parseFloat(underElem.find('.bet-match-odd-value').text().trim()) || undefined;
        }
      }
      
      // Generate unique ID
      const id = `mozzart_${date}_${homeTeam}_${awayTeam}`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      
      // Only add matches with valid 1X2 odds
      if (homeWinOdds > 0 && drawOdds > 0 && awayWinOdds > 0) {
        odds.push({
          id,
          home_team: homeTeam,
          away_team: awayTeam,
          match_time: matchTime,
          match_timestamp: matchTimestamp,
          league: leagueName,
          home_win_odds: homeWinOdds,
          draw_odds: drawOdds,
          away_win_odds: awayWinOdds,
          btts_yes_odds: bttsYesOdds,
          btts_no_odds: bttsNoOdds,
          over_2_5_odds: over25Odds,
          under_2_5_odds: under25Odds
        });
      }
    } catch (error) {
      // Log the error but continue processing other matches
      console.error('Error parsing match:', error);
    }
  });
  
  return odds;
}