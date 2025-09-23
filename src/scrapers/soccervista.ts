import * as cheerio from 'cheerio';
import dayjs from 'dayjs';
import { fetchHtml, saveHtmlToFile, loadHtmlFromFile } from '../utils/http';
import { scheduleRequest } from '../utils/rateLimiter';

// Interfaces
interface SoccervistaMatch {
  id: string;
  league: string;
  country: string;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  kickoff_timestamp: number;
  home_odds?: number;
  draw_odds?: number;
  away_odds?: number;
  prediction?: string;
  home_form?: string[];
  away_form?: string[];
  raw_data?: any;
}

/**
 * Scrape match data from Soccervista for a specific date
 * @param date Date to scrape in YYYY-MM-DD format
 * @param useOffline Whether to use offline stored HTML
 * @returns Array of match data
 */
export async function scrapeSoccervistaMatches(date: string, useOffline = false): Promise<SoccervistaMatch[]> {
  console.log(`Scraping Soccervista for ${date}...`);
  
  const dateFormatted = dayjs(date).format('YYYY-MM-DD');
  const url = `https://www.soccervista.com/soccer_games.php?date=${dateFormatted}`;
  
  let html = '';
  
  if (useOffline) {
    try {
      html = await loadHtmlFromFile('soccervista', date);
      console.log('Using offline Soccervista data');
    } catch (error) {
      console.error('Could not load offline Soccervista data:', error);
      throw new Error('Offline data requested but not available');
    }
  } else {
    // Soccervista can be scraped with a simple HTTP request
    await scheduleRequest(url, async () => {
      html = await fetchHtml(url);
      await saveHtmlToFile(html, 'soccervista', date);
    });
  }
  
  // Parse the HTML to extract match data
  return parseSoccervistaHtml(html, date);
}

/**
 * Parse Soccervista HTML to extract match data
 * @param html HTML content from Soccervista
 * @param date Date in YYYY-MM-DD format
 * @returns Array of match data
 */
function parseSoccervistaHtml(html: string, date: string): SoccervistaMatch[] {
  const matches: SoccervistaMatch[] = [];
  const $ = cheerio.load(html);
  
  // Find all match tables
  $('table.matches').each((_, table) => {
    let currentCountry = 'Unknown';
    let currentLeague = 'Unknown';
    
    // Find country and league names
    const leagueHeader = $(table).prev('h2');
    if (leagueHeader.length) {
      const leagueText = leagueHeader.text().trim();
      const parts = leagueText.split(':');
      
      if (parts.length >= 2) {
        currentCountry = parts[0].trim();
        currentLeague = parts[1].trim();
      } else {
        currentLeague = leagueText;
      }
    }
    
    // Process each match row
    $(table).find('tr').each((_, tr) => {
      const cells = $(tr).find('td');
      
      // Skip header rows or rows without enough cells
      if (cells.length < 6) return;
      
      const timeCell = $(cells[0]).text().trim();
      const teamsCell = $(cells[1]).text().trim();
      const oddsHomeCellText = $(cells[2]).text().trim();
      const oddsDrawCellText = $(cells[3]).text().trim();
      const oddsAwayCellText = $(cells[4]).text().trim();
      const predictionCell = $(cells[5]).text().trim();
      
      // Skip rows without valid time or teams
      if (!timeCell || !teamsCell) return;
      
      // Parse teams
      const teamsParts = teamsCell.split(' - ');
      if (teamsParts.length !== 2) return;
      
      const homeTeam = teamsParts[0].trim();
      const awayTeam = teamsParts[1].trim();
      
      // Parse time
      const timeRegex = /(\d{2}):(\d{2})/;
      const timeMatch = timeCell.match(timeRegex);
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
      
      // Parse odds
      const homeOdds = parseFloat(oddsHomeCellText) || undefined;
      const drawOdds = parseFloat(oddsDrawCellText) || undefined;
      const awayOdds = parseFloat(oddsAwayCellText) || undefined;
      
      // Generate unique ID
      const id = `sv_${date}_${homeTeam}_${awayTeam}`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      
      matches.push({
        id,
        league: currentLeague,
        country: currentCountry,
        home_team: homeTeam,
        away_team: awayTeam,
        kickoff_time: kickoffTime,
        kickoff_timestamp: kickoffTimestamp,
        home_odds: homeOdds,
        draw_odds: drawOdds,
        away_odds: awayOdds,
        prediction: predictionCell || undefined
      });
    });
  });
  
  return matches;
}