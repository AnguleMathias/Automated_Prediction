import fs from 'fs-extra';
import path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import { PredictionResult } from '../model/predict';

/**
 * Write prediction results to a CSV file
 * @param predictions Array of prediction results
 * @param outputPath Path to save the CSV file
 */
export async function writeCsvSummary(predictions: PredictionResult[], outputPath: string): Promise<void> {
  // Define CSV header
  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: 'match_id', title: 'Match ID' },
      { id: 'date', title: 'Date' },
      { id: 'kickoff_time', title: 'Kickoff Time (UTC)' },
      { id: 'league', title: 'League' },
      { id: 'country', title: 'Country' },
      { id: 'home_team', title: 'Home Team' },
      { id: 'away_team', title: 'Away Team' },
      { id: 'prob_home', title: 'Home Win Prob' },
      { id: 'prob_draw', title: 'Draw Prob' },
      { id: 'prob_away', title: 'Away Win Prob' },
      { id: 'prob_btts_yes', title: 'BTTS Yes Prob' },
      { id: 'prob_over_2_5', title: 'Over 2.5 Prob' },
      { id: 'expected_goals', title: 'Expected Goals' },
      { id: 'recommendation', title: 'Recommendation' },
      { id: 'bookmaker', title: 'Bookmaker' },
      { id: 'odds', title: 'Odds' },
      { id: 'confidence', title: 'Confidence' },
      { id: 'edge', title: 'Edge' },
      { id: 'ev', title: 'Expected Value' }
    ]
  });
  
  // Format data for CSV
  const records = predictions.map(p => ({
    match_id: p.match_id,
    date: p.date,
    kickoff_time: p.kickoff_time,
    league: p.league,
    country: p.country,
    home_team: p.home_team,
    away_team: p.away_team,
    prob_home: p.model_prob_1x2.home.toFixed(4),
    prob_draw: p.model_prob_1x2.draw.toFixed(4),
    prob_away: p.model_prob_1x2.away.toFixed(4),
    prob_btts_yes: p.model_prob_btts.yes.toFixed(4),
    prob_over_2_5: p.model_prob_over_under.over_2_5.toFixed(4),
    expected_goals: p.model_prob_over_under.expected_goals.toFixed(2),
    recommendation: p.recommendation?.bet || '',
    bookmaker: p.recommendation?.bookmaker || '',
    odds: p.recommendation?.odds || '',
    confidence: p.recommendation?.confidence ? p.recommendation.confidence.toFixed(4) : '',
    edge: p.recommendation?.edge ? p.recommendation.edge.toFixed(4) : '',
    ev: p.recommendation?.ev ? p.recommendation.ev.toFixed(4) : ''
  }));
  
  // Write to CSV
  await csvWriter.writeRecords(records);
  console.log(`CSV summary saved to ${outputPath}`);
}