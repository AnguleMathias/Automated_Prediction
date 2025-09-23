import _ from 'lodash';
import { MatchFeatures } from './features';

// Interfaces
export interface PredictionResult {
  match_id: string;
  date: string;
  timestamp: number;
  league: string;
  country: string;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  model_prob_1x2: {
    home: number;
    draw: number;
    away: number;
  };
  model_prob_btts: {
    yes: number;
    no: number;
  };
  model_prob_over_under: {
    over_2_5: number;
    under_2_5: number;
    expected_goals: number;
  };
  best_bookmaker: string;
  best_odds: number;
  recommendation?: {
    bet: string;
    bookmaker: string;
    odds: number;
    confidence: number;
    ev: number;
    edge: number;
  };
  raw_features: any;
}

// Configuration
const EDGE_THRESHOLD = process.env.EDGE_THRESHOLD ? parseFloat(process.env.EDGE_THRESHOLD) : 0.08; // 8%
const CONFIDENCE_THRESHOLD = process.env.CONFIDENCE_THRESHOLD ? parseFloat(process.env.CONFIDENCE_THRESHOLD) : 0.65; // 65%

/**
 * Predict match outcomes
 * @param matches Array of match features
 * @returns Array of prediction results
 */
export async function predictMatches(matches: MatchFeatures[]): Promise<PredictionResult[]> {
  const predictions: PredictionResult[] = [];
  
  for (const match of matches) {
    try {
      // 1X2 Prediction
      const prob1X2 = predict1X2(match);
      
      // BTTS Prediction
      const probBTTS = predictBTTS(match);
      
      // Over/Under Prediction
      const probOverUnder = predictOverUnder(match);
      
      // Find the best bookmaker and odds
      let bestBet = '';
      let bestBookmaker = '';
      let bestOdds = 0;
      let confidence = 0;
      let ev = 0;
      let edge = 0;
      
      // Check for value bets in 1X2 market
      const homeEdge = prob1X2.home - match.features.market_implied_prob_home;
      const drawEdge = prob1X2.draw - match.features.market_implied_prob_draw;
      const awayEdge = prob1X2.away - match.features.market_implied_prob_away;
      
      // Find the best value bet
      let maxEdge = 0;
      
      if (homeEdge > EDGE_THRESHOLD && prob1X2.home > CONFIDENCE_THRESHOLD) {
        const homeEV = (prob1X2.home * match.best_odds.best_home_win.odds.decimal) - 1;
        if (homeEdge > maxEdge) {
          bestBet = '1';
          bestBookmaker = match.best_odds.best_home_win.bookmaker;
          bestOdds = match.best_odds.best_home_win.odds.decimal;
          confidence = prob1X2.home;
          ev = homeEV;
          edge = homeEdge;
          maxEdge = homeEdge;
        }
      }
      
      if (drawEdge > EDGE_THRESHOLD && prob1X2.draw > CONFIDENCE_THRESHOLD) {
        const drawEV = (prob1X2.draw * match.best_odds.best_draw.odds.decimal) - 1;
        if (drawEdge > maxEdge) {
          bestBet = 'X';
          bestBookmaker = match.best_odds.best_draw.bookmaker;
          bestOdds = match.best_odds.best_draw.odds.decimal;
          confidence = prob1X2.draw;
          ev = drawEV;
          edge = drawEdge;
          maxEdge = drawEdge;
        }
      }
      
      if (awayEdge > EDGE_THRESHOLD && prob1X2.away > CONFIDENCE_THRESHOLD) {
        const awayEV = (prob1X2.away * match.best_odds.best_away_win.odds.decimal) - 1;
        if (awayEdge > maxEdge) {
          bestBet = '2';
          bestBookmaker = match.best_odds.best_away_win.bookmaker;
          bestOdds = match.best_odds.best_away_win.odds.decimal;
          confidence = prob1X2.away;
          ev = awayEV;
          edge = awayEdge;
          maxEdge = awayEdge;
        }
      }
      
      // Check for value bets in BTTS market
      if (match.features.market_implied_prob_btts_yes !== undefined && 
          match.best_odds.best_btts_yes) {
        const bttsYesEdge = probBTTS.yes - match.features.market_implied_prob_btts_yes;
        
        if (bttsYesEdge > EDGE_THRESHOLD && probBTTS.yes > CONFIDENCE_THRESHOLD) {
          const bttsYesEV = (probBTTS.yes * match.best_odds.best_btts_yes.odds.decimal) - 1;
          
          if (bttsYesEdge > maxEdge) {
            bestBet = 'BTTS Yes';
            bestBookmaker = match.best_odds.best_btts_yes.bookmaker;
            bestOdds = match.best_odds.best_btts_yes.odds.decimal;
            confidence = probBTTS.yes;
            ev = bttsYesEV;
            edge = bttsYesEdge;
            maxEdge = bttsYesEdge;
          }
        }
      }
      
      // Check for value bets in Over/Under market
      if (match.features.market_implied_prob_over_2_5 !== undefined &&
          match.best_odds.best_over_2_5) {
        const overEdge = probOverUnder.over_2_5 - match.features.market_implied_prob_over_2_5;
        
        if (overEdge > EDGE_THRESHOLD && probOverUnder.over_2_5 > CONFIDENCE_THRESHOLD) {
          const overEV = (probOverUnder.over_2_5 * match.best_odds.best_over_2_5.odds.decimal) - 1;
          
          if (overEdge > maxEdge) {
            bestBet = 'Over 2.5';
            bestBookmaker = match.best_odds.best_over_2_5.bookmaker;
            bestOdds = match.best_odds.best_over_2_5.odds.decimal;
            confidence = probOverUnder.over_2_5;
            ev = overEV;
            edge = overEdge;
            maxEdge = overEdge;
          }
        }
      }
      
      // Create prediction result
      const prediction: PredictionResult = {
        match_id: match.match_id,
        date: match.date,
        timestamp: match.timestamp,
        league: match.league,
        country: match.country,
        home_team: match.home_team.name,
        away_team: match.away_team.name,
        kickoff_time: new Date(match.timestamp * 1000).toISOString(),
        model_prob_1x2: prob1X2,
        model_prob_btts: probBTTS,
        model_prob_over_under: probOverUnder,
        best_bookmaker: bestBookmaker,
        best_odds: bestOdds,
        raw_features: match.features
      };
      
      // Add recommendation if we have a value bet
      if (bestBet && bestBookmaker && bestOdds > 0 && confidence > 0) {
        prediction.recommendation = {
          bet: bestBet,
          bookmaker: bestBookmaker,
          odds: bestOdds,
          confidence,
          ev,
          edge
        };
      }
      
      predictions.push(prediction);
    } catch (error) {
      console.error(`Error predicting match ${match.match_id}:`, error);
    }
  }
  
  return predictions;
}

/**
 * Simple 1X2 prediction model
 * @param match Match features
 * @returns Object with home, draw, away probabilities
 */
function predict1X2(match: MatchFeatures): { home: number; draw: number; away: number } {
  // In a real implementation, this would use a trained ML model
  // For this example, we'll use a simple heuristic based on features
  
  const f = match.features;
  
  // Base probabilities from bookmakers (if available)
  let homeProb = f.market_implied_prob_home || 0.45;
  let drawProb = f.market_implied_prob_draw || 0.25;
  let awayProb = f.market_implied_prob_away || 0.30;
  
  // Adjust based on form
  const formDiff = (f.home_form_points / 15) - (f.away_form_points / 15);
  homeProb += formDiff * 0.1;
  awayProb -= formDiff * 0.1;
  
  // Adjust based on goals
  const homeAttackStrength = f.home_goals_scored_avg / 1.5;
  const homeDefenseWeakness = f.home_goals_conceded_avg / 1.5;
  const awayAttackStrength = f.away_goals_scored_avg / 1.5;
  const awayDefenseWeakness = f.away_goals_conceded_avg / 1.5;
  
  const homeGoalPower = homeAttackStrength * awayDefenseWeakness;
  const awayGoalPower = awayAttackStrength * homeDefenseWeakness;
  
  homeProb += (homeGoalPower - awayGoalPower) * 0.05;
  awayProb += (awayGoalPower - homeGoalPower) * 0.05;
  
  // Adjust based on H2H
  const h2hFactor = (f.h2h_home_wins - f.h2h_away_wins) / (f.h2h_home_wins + f.h2h_draws + f.h2h_away_wins || 1);
  homeProb += h2hFactor * 0.05;
  awayProb -= h2hFactor * 0.05;
  
  // Home advantage
  homeProb += 0.05;
  awayProb -= 0.05;
  
  // Adjust draw probability
  const closenessOfMatch = 1 - Math.abs(homeProb - awayProb);
  drawProb += closenessOfMatch * 0.1;
  
  // Ensure probabilities are in valid range
  homeProb = Math.min(Math.max(homeProb, 0.05), 0.9);
  drawProb = Math.min(Math.max(drawProb, 0.05), 0.6);
  awayProb = Math.min(Math.max(awayProb, 0.05), 0.9);
  
  // Normalize to sum to 1
  const totalProb = homeProb + drawProb + awayProb;
  
  return {
    home: homeProb / totalProb,
    draw: drawProb / totalProb,
    away: awayProb / totalProb
  };
}

/**
 * Simple BTTS prediction model
 * @param match Match features
 * @returns Object with yes/no probabilities
 */
function predictBTTS(match: MatchFeatures): { yes: number; no: number } {
  // In a real implementation, this would use a trained ML model
  // For this example, we'll use a simple heuristic based on features
  
  const f = match.features;
  
  // Base probability from bookmakers (if available)
  let bttsYesProb = f.market_implied_prob_btts_yes || 0.55;
  
  // Adjust based on team scoring and conceding records
  const homeScoring = f.home_goals_scored_avg / 1.5;
  const homeConceding = f.home_goals_conceded_avg / 1.5;
  const awayScoring = f.away_goals_scored_avg / 1.5;
  const awayConceding = f.away_goals_conceded_avg / 1.5;
  
  // Teams that score a lot and concede a lot are more likely for BTTS
  bttsYesProb += (homeScoring * awayConceding + awayScoring * homeConceding) * 0.1;
  
  // H2H history affects BTTS
  const h2hBTTSRate = match.h2h_matches.reduce((count, m) => 
    (m.home_score > 0 && m.away_score > 0) ? count + 1 : count, 0
  ) / (match.h2h_matches.length || 1);
  
  bttsYesProb = (bttsYesProb + h2hBTTSRate) / 2;
  
  // Ensure probability is in valid range
  bttsYesProb = Math.min(Math.max(bttsYesProb, 0.1), 0.9);
  
  return {
    yes: bttsYesProb,
    no: 1 - bttsYesProb
  };
}

/**
 * Simple Over/Under prediction model
 * @param match Match features
 * @returns Object with over/under probabilities and expected goals
 */
function predictOverUnder(match: MatchFeatures): { 
  over_2_5: number; 
  under_2_5: number; 
  expected_goals: number;
} {
  // In a real implementation, this would use a trained ML model
  // For this example, we'll use a simple heuristic based on features
  
  const f = match.features;
  
  // Base probability from bookmakers (if available)
  let overProb = f.market_implied_prob_over_2_5 || 0.5;
  
  // Calculate expected goals
  const homeExpectedGoals = f.home_goals_scored_avg * f.away_goals_conceded_avg * f.home_advantage_factor;
  const awayExpectedGoals = f.away_goals_scored_avg * f.home_goals_conceded_avg;
  
  const totalExpectedGoals = homeExpectedGoals + awayExpectedGoals;
  
  // Adjust over probability based on expected goals
  if (totalExpectedGoals > 2.5) {
    overProb += (totalExpectedGoals - 2.5) * 0.1;
  } else {
    overProb -= (2.5 - totalExpectedGoals) * 0.1;
  }
  
  // H2H history affects over/under
  const h2hAvgGoals = match.h2h_matches.reduce((sum, m) => 
    sum + m.home_score + m.away_score, 0
  ) / (match.h2h_matches.length || 1);
  
  overProb = (overProb + (h2hAvgGoals > 2.5 ? 0.6 : 0.4)) / 2;
  
  // Ensure probability is in valid range
  overProb = Math.min(Math.max(overProb, 0.1), 0.9);
  
  return {
    over_2_5: overProb,
    under_2_5: 1 - overProb,
    expected_goals: totalExpectedGoals
  };
}