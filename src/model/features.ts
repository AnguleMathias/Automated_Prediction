import _ from 'lodash';
import dayjs from 'dayjs';
import { BookmakerOdds, normalizeBookmakerOdds, findBestOdds } from '../normalize';

// Interfaces
export interface TeamInfo {
  id: string;
  name: string;
  form: string[];  // W, D, L
  goals_scored_last5: number;
  goals_conceded_last5: number;
  home_form?: string[];
  away_form?: string[];
  elo_rating?: number;
}

export interface H2HMatch {
  date: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  competition: string;
}

export interface MatchFeatures {
  match_id: string;
  date: string;
  timestamp: number;
  league: string;
  country: string;
  home_team: TeamInfo;
  away_team: TeamInfo;
  h2h_matches: H2HMatch[];
  bookmaker_odds: BookmakerOdds[];
  best_odds: {
    best_home_win: { bookmaker: string; odds: any };
    best_draw: { bookmaker: string; odds: any };
    best_away_win: { bookmaker: string; odds: any };
    best_btts_yes?: { bookmaker: string; odds: any };
    best_btts_no?: { bookmaker: string; odds: any };
    best_over_2_5?: { bookmaker: string; odds: any };
    best_under_2_5?: { bookmaker: string; odds: any };
  };
  features: {
    home_form_points: number;
    away_form_points: number;
    home_goals_scored_avg: number;
    home_goals_conceded_avg: number;
    away_goals_scored_avg: number;
    away_goals_conceded_avg: number;
    h2h_home_wins: number;
    h2h_draws: number;
    h2h_away_wins: number;
    h2h_home_goals_avg: number;
    h2h_away_goals_avg: number;
    home_advantage_factor: number;
    days_rest_home?: number;
    days_rest_away?: number;
    home_elo?: number;
    away_elo?: number;
    market_implied_prob_home: number;
    market_implied_prob_draw: number;
    market_implied_prob_away: number;
    market_implied_prob_btts_yes?: number;
    market_implied_prob_over_2_5?: number;
  };
}

/**
 * Generate features for match prediction
 * @param flashscoreMatches Matches from Flashscore
 * @param soccervistaMatches Matches from Soccervista
 * @param freesupertipsData Data from Freesupertips
 * @param mozzartOdds Odds from Mozzart
 * @param betikaOdds Odds from Betika
 * @param sportpesaOdds Odds from SportPesa
 * @returns Array of MatchFeatures objects
 */
export function generateFeatures(
  flashscoreMatches: any[],
  soccervistaMatches: any[],
  freesupertipsData: any[],
  mozzartOdds: any[],
  betikaOdds: any[],
  sportpesaOdds: any[]
): MatchFeatures[] {
  const matches: MatchFeatures[] = [];
  
  // Merge data from different sources
  const mergedMatches = mergeMatchData(flashscoreMatches, soccervistaMatches, freesupertipsData);
  
  // Process each merged match
  for (const match of mergedMatches) {
    // Create team info objects
    const homeTeam: TeamInfo = {
      id: createTeamId(match.home_team),
      name: match.home_team,
      form: match.home_form || [],
      goals_scored_last5: match.home_goals_scored_last5 || 0,
      goals_conceded_last5: match.home_goals_conceded_last5 || 0,
      home_form: match.home_home_form || [],
      elo_rating: match.home_elo || 1500
    };
    
    const awayTeam: TeamInfo = {
      id: createTeamId(match.away_team),
      name: match.away_team,
      form: match.away_form || [],
      goals_scored_last5: match.away_goals_scored_last5 || 0,
      goals_conceded_last5: match.away_goals_conceded_last5 || 0,
      away_form: match.away_away_form || [],
      elo_rating: match.away_elo || 1500
    };
    
    // Collect H2H matches
    const h2hMatches: H2HMatch[] = match.h2h_matches || [];
    
    // Merge and normalize bookmaker odds
    const bookmakerOdds: BookmakerOdds[] = [];
    
    // Find matching odds from each bookmaker
    const matchMozzartOdds = findMatchingOdds(mozzartOdds, match.home_team, match.away_team);
    const matchBetikaOdds = findMatchingOdds(betikaOdds, match.home_team, match.away_team);
    const matchSportpesaOdds = findMatchingOdds(sportpesaOdds, match.home_team, match.away_team);
    
    // Add normalized odds from each bookmaker
    if (matchMozzartOdds) {
      bookmakerOdds.push(normalizeBookmakerOdds(
        'Mozzart',
        matchMozzartOdds.home_win_odds,
        matchMozzartOdds.draw_odds,
        matchMozzartOdds.away_win_odds,
        matchMozzartOdds.btts_yes_odds,
        matchMozzartOdds.btts_no_odds,
        matchMozzartOdds.over_2_5_odds,
        matchMozzartOdds.under_2_5_odds
      ));
    }
    
    if (matchBetikaOdds) {
      bookmakerOdds.push(normalizeBookmakerOdds(
        'Betika',
        matchBetikaOdds.home_win_odds,
        matchBetikaOdds.draw_odds,
        matchBetikaOdds.away_win_odds,
        matchBetikaOdds.btts_yes_odds,
        matchBetikaOdds.btts_no_odds,
        matchBetikaOdds.over_2_5_odds,
        matchBetikaOdds.under_2_5_odds
      ));
    }
    
    if (matchSportpesaOdds) {
      bookmakerOdds.push(normalizeBookmakerOdds(
        'SportPesa',
        matchSportpesaOdds.home_win_odds,
        matchSportpesaOdds.draw_odds,
        matchSportpesaOdds.away_win_odds,
        matchSportpesaOdds.btts_yes_odds,
        matchSportpesaOdds.btts_no_odds,
        matchSportpesaOdds.over_2_5_odds,
        matchSportpesaOdds.under_2_5_odds
      ));
    }
    
    // Find best odds across bookmakers
    let bestOdds = { best_home_win: { bookmaker: '', odds: { decimal: 0 } } } as any;
    
    if (bookmakerOdds.length > 0) {
      bestOdds = findBestOdds(bookmakerOdds);
    }
    
    // Generate feature values
    const features = {
      home_form_points: calculateFormPoints(homeTeam.form),
      away_form_points: calculateFormPoints(awayTeam.form),
      home_goals_scored_avg: homeTeam.goals_scored_last5 / 5,
      home_goals_conceded_avg: homeTeam.goals_conceded_last5 / 5,
      away_goals_scored_avg: awayTeam.goals_scored_last5 / 5,
      away_goals_conceded_avg: awayTeam.goals_conceded_last5 / 5,
      h2h_home_wins: countH2HResults(h2hMatches, match.home_team, 'win'),
      h2h_draws: countH2HResults(h2hMatches, match.home_team, 'draw'),
      h2h_away_wins: countH2HResults(h2hMatches, match.home_team, 'loss'),
      h2h_home_goals_avg: calculateH2HGoalsAvg(h2hMatches, match.home_team),
      h2h_away_goals_avg: calculateH2HGoalsAvg(h2hMatches, match.away_team),
      home_advantage_factor: 1.2, // Default value
      days_rest_home: match.home_days_rest || undefined,
      days_rest_away: match.away_days_rest || undefined,
      home_elo: homeTeam.elo_rating,
      away_elo: awayTeam.elo_rating,
      market_implied_prob_home: bookmakerOdds.length > 0 
        ? _.meanBy(bookmakerOdds, b => b.fair_home_win.impliedProbability)
        : 0,
      market_implied_prob_draw: bookmakerOdds.length > 0
        ? _.meanBy(bookmakerOdds, b => b.fair_draw.impliedProbability)
        : 0,
      market_implied_prob_away: bookmakerOdds.length > 0
        ? _.meanBy(bookmakerOdds, b => b.fair_away_win.impliedProbability)
        : 0,
      market_implied_prob_btts_yes: bookmakerOdds.some(b => b.btts_yes)
        ? _.meanBy(bookmakerOdds.filter(b => b.btts_yes), b => b.btts_yes!.impliedProbability)
        : undefined,
      market_implied_prob_over_2_5: bookmakerOdds.some(b => b.over_2_5)
        ? _.meanBy(bookmakerOdds.filter(b => b.over_2_5), b => b.over_2_5!.impliedProbability)
        : undefined
    };
    
    // Create match features object
    matches.push({
      match_id: match.id || `${match.date}_${match.home_team}_${match.away_team}`.replace(/[^a-z0-9]/gi, '_').toLowerCase(),
      date: match.date || match.kickoff_time?.split(' ')[0] || '',
      timestamp: match.kickoff_timestamp || dayjs(match.kickoff_time).unix(),
      league: match.league || '',
      country: match.country || '',
      home_team: homeTeam,
      away_team: awayTeam,
      h2h_matches: h2hMatches,
      bookmaker_odds: bookmakerOdds,
      best_odds: bestOdds,
      features
    });
  }
  
  return matches;
}

/**
 * Merge match data from different sources
 * @param flashscoreMatches Matches from Flashscore
 * @param soccervistaMatches Matches from Soccervista
 * @param freesupertipsData Data from Freesupertips
 * @returns Array of merged match data
 */
function mergeMatchData(
  flashscoreMatches: any[],
  soccervistaMatches: any[],
  freesupertipsData: any[]
): any[] {
  // Start with Flashscore matches as base
  const mergedMatches = [...flashscoreMatches];
  
  // Function to find matching match in array
  const findMatchingMatch = (array: any[], homeTeam: string, awayTeam: string) => {
    return array.find(m => 
      isSimilarTeamName(m.home_team, homeTeam) && 
      isSimilarTeamName(m.away_team, awayTeam)
    );
  };
  
  // Merge data from Soccervista
  for (const svMatch of soccervistaMatches) {
    const existingMatch = findMatchingMatch(mergedMatches, svMatch.home_team, svMatch.away_team);
    
    if (existingMatch) {
      // Update existing match with Soccervista data
      Object.assign(existingMatch, {
        sv_prediction: svMatch.prediction,
        home_odds: svMatch.home_odds || existingMatch.home_odds,
        draw_odds: svMatch.draw_odds || existingMatch.draw_odds,
        away_odds: svMatch.away_odds || existingMatch.away_odds
      });
    } else {
      // Add new match from Soccervista
      mergedMatches.push(svMatch);
    }
  }
  
  // Merge data from Freesupertips
  for (const fsMatch of freesupertipsData) {
    const existingMatch = findMatchingMatch(mergedMatches, fsMatch.home_team, fsMatch.away_team);
    
    if (existingMatch) {
      // Update existing match with Freesupertips data
      Object.assign(existingMatch, {
        fs_prediction: fsMatch.prediction,
        h2h_matches: fsMatch.h2h_matches || existingMatch.h2h_matches,
        home_form: fsMatch.home_form || existingMatch.home_form,
        away_form: fsMatch.away_form || existingMatch.away_form,
        home_goals_scored_last5: fsMatch.home_goals_scored_last5 || existingMatch.home_goals_scored_last5 || 0,
        home_goals_conceded_last5: fsMatch.home_goals_conceded_last5 || existingMatch.home_goals_conceded_last5 || 0,
        away_goals_scored_last5: fsMatch.away_goals_scored_last5 || existingMatch.away_goals_scored_last5 || 0,
        away_goals_conceded_last5: fsMatch.away_goals_conceded_last5 || existingMatch.away_goals_conceded_last5 || 0
      });
    }
  }
  
  return mergedMatches;
}

/**
 * Find matching odds for a match
 * @param oddsArray Array of odds data
 * @param homeTeam Home team name
 * @param awayTeam Away team name
 * @returns Matching odds object or undefined
 */
function findMatchingOdds(oddsArray: any[], homeTeam: string, awayTeam: string): any {
  return oddsArray.find(o => 
    isSimilarTeamName(o.home_team, homeTeam) && 
    isSimilarTeamName(o.away_team, awayTeam)
  );
}

/**
 * Check if two team names are similar (handles spelling variations)
 * @param name1 First team name
 * @param name2 Second team name
 * @returns Boolean indicating similarity
 */
function isSimilarTeamName(name1: string, name2: string): boolean {
  // Normalize names
  const normalize = (name: string) => {
    return name
      .toLowerCase()
      .replace(/\s+fc\b|\bfc\s+|\s+f\.c\.\b|\bf\.c\.\s+/g, ' ')  // Remove FC
      .replace(/\s+united\b|\bunited\s+|\s+utd\b|\butd\s+/g, ' ') // Normalize United
      .replace(/\s+city\b|\bcity\s+/g, ' ')                       // Remove City
      .replace(/[^a-z0-9]/g, '')                                  // Remove non-alphanumeric
      .trim();
  };
  
  const normName1 = normalize(name1);
  const normName2 = normalize(name2);
  
  // Check for exact match
  if (normName1 === normName2) {
    return true;
  }
  
  // Check for one being substring of the other
  if (normName1.includes(normName2) || normName2.includes(normName1)) {
    return true;
  }
  
  // Levenshtein distance for similar names
  const distance = levenshteinDistance(normName1, normName2);
  const maxLength = Math.max(normName1.length, normName2.length);
  
  // Allow more distance for longer names
  const threshold = maxLength > 10 ? 3 : (maxLength > 5 ? 2 : 1);
  
  return distance <= threshold;
}

/**
 * Calculate Levenshtein distance between two strings
 * @param str1 First string
 * @param str2 Second string
 * @returns Levenshtein distance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  // Create distance matrix
  const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
  
  // Initialize first row and column
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }
  
  // Fill distance matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // Deletion
        dp[i][j - 1] + 1,      // Insertion
        dp[i - 1][j - 1] + cost // Substitution
      );
    }
  }
  
  return dp[m][n];
}

/**
 * Create a unique ID for a team
 * @param teamName Team name
 * @returns Unique team ID
 */
function createTeamId(teamName: string): string {
  return teamName.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

/**
 * Calculate points from form array (W=3, D=1, L=0)
 * @param form Array of form results (W, D, L)
 * @returns Total form points
 */
function calculateFormPoints(form: string[]): number {
  if (!form || form.length === 0) {
    return 0;
  }
  
  return form.reduce((points, result) => {
    if (result === 'W') return points + 3;
    if (result === 'D') return points + 1;
    return points;
  }, 0);
}

/**
 * Count H2H results for a team
 * @param h2hMatches Array of H2H matches
 * @param teamName Team name
 * @param result Result to count (win, draw, loss)
 * @returns Count of specified results
 */
function countH2HResults(h2hMatches: H2HMatch[], teamName: string, result: 'win' | 'draw' | 'loss'): number {
  if (!h2hMatches || h2hMatches.length === 0) {
    return 0;
  }
  
  return h2hMatches.reduce((count, match) => {
    const isHomeTeam = isSimilarTeamName(match.home_team, teamName);
    const isAwayTeam = isSimilarTeamName(match.away_team, teamName);
    
    if (!isHomeTeam && !isAwayTeam) {
      return count;
    }
    
    if (result === 'draw' && match.home_score === match.away_score) {
      return count + 1;
    }
    
    if (result === 'win') {
      if (isHomeTeam && match.home_score > match.away_score) {
        return count + 1;
      }
      if (isAwayTeam && match.away_score > match.home_score) {
        return count + 1;
      }
    }
    
    if (result === 'loss') {
      if (isHomeTeam && match.home_score < match.away_score) {
        return count + 1;
      }
      if (isAwayTeam && match.away_score < match.home_score) {
        return count + 1;
      }
    }
    
    return count;
  }, 0);
}

/**
 * Calculate average goals for a team in H2H matches
 * @param h2hMatches Array of H2H matches
 * @param teamName Team name
 * @returns Average goals per match
 */
function calculateH2HGoalsAvg(h2hMatches: H2HMatch[], teamName: string): number {
  if (!h2hMatches || h2hMatches.length === 0) {
    return 0;
  }
  
  let totalGoals = 0;
  let matchCount = 0;
  
  for (const match of h2hMatches) {
    if (isSimilarTeamName(match.home_team, teamName)) {
      totalGoals += match.home_score;
      matchCount++;
    } else if (isSimilarTeamName(match.away_team, teamName)) {
      totalGoals += match.away_score;
      matchCount++;
    }
  }
  
  return matchCount > 0 ? totalGoals / matchCount : 0;
}