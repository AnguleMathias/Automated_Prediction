import fs from 'fs-extra';
import path from 'path';
import dayjs from 'dayjs';
import { PredictionResult } from '../model/predict';

/**
 * Render an HTML report for predictions
 * @param date Date of the predictions
 * @param predictions Array of prediction results
 * @param outputPath Path to save the HTML file
 */
export function renderHtmlReport(date: string, predictions: PredictionResult[], outputPath: string): void {
  // Sort predictions by confidence (highest first)
  const sortedPredictions = [...predictions].sort((a, b) => {
    const aConf = a.recommendation?.confidence || 0;
    const bConf = b.recommendation?.confidence || 0;
    return bConf - aConf;
  });
  
  // Create rows for each prediction
  const predictionRows = sortedPredictions.map(p => {
    // Determine row color based on confidence
    let rowColor = '#ffd6d6'; // Default: red (avoid)
    let recommendationText = 'No Recommendation';
    
    if (p.recommendation) {
      const confidence = p.recommendation.confidence;
      
      if (confidence >= 0.8) {
        rowColor = '#c8f7c5'; // Green (high confidence)
      } else if (confidence >= 0.65) {
        rowColor = '#fff4cc'; // Amber (medium confidence)
      }
      
      recommendationText = `${p.recommendation.bet} @ ${p.recommendation.odds.toFixed(2)} (${p.recommendation.bookmaker})`;
    }
    
    // Format probabilities
    const home1X2 = (p.model_prob_1x2.home * 100).toFixed(1);
    const draw1X2 = (p.model_prob_1x2.draw * 100).toFixed(1);
    const away1X2 = (p.model_prob_1x2.away * 100).toFixed(1);
    
    const bttsYes = (p.model_prob_btts.yes * 100).toFixed(1);
    const overProb = (p.model_prob_over_under.over_2_5 * 100).toFixed(1);
    const expGoals = p.model_prob_over_under.expected_goals.toFixed(1);
    
    // Format match time
    const matchTime = dayjs(p.kickoff_time).format('HH:mm');
    const matchDate = dayjs(p.kickoff_time).format('DD/MM/YYYY');
    
    // Edge and EV values
    const edge = p.recommendation ? (p.recommendation.edge * 100).toFixed(1) + '%' : '-';
    const ev = p.recommendation ? p.recommendation.ev.toFixed(2) : '-';
    
    return `
      <tr style="background-color: ${rowColor}">
        <td>${p.league}</td>
        <td>${matchDate} ${matchTime}</td>
        <td>${p.home_team} vs ${p.away_team}</td>
        <td>${home1X2}% / ${draw1X2}% / ${away1X2}%</td>
        <td>${bttsYes}%</td>
        <td>${overProb}% (${expGoals})</td>
        <td>${recommendationText}</td>
        <td>${edge}</td>
        <td>${ev}</td>
      </tr>
    `;
  }).join('');
  
  // Create top picks section (only those with recommendations)
  const topPicks = sortedPredictions
    .filter(p => p.recommendation && p.recommendation.confidence >= 0.7)
    .slice(0, 5);
  
  const topPicksSection = topPicks.length > 0
    ? `
      <div class="top-picks">
        <h2>Top Picks</h2>
        <ul>
          ${topPicks.map(p => `
            <li>
              <strong>${p.home_team} vs ${p.away_team}</strong> - 
              ${p.recommendation!.bet} @ ${p.recommendation!.odds.toFixed(2)} (${p.recommendation!.bookmaker})
              <br>
              <small>
                Confidence: ${(p.recommendation!.confidence * 100).toFixed(1)}% | 
                Edge: ${(p.recommendation!.edge * 100).toFixed(1)}% | 
                EV: ${p.recommendation!.ev.toFixed(2)}
              </small>
              <br>
              <small>
                Reasoning: ${generateReasoning(p)}
              </small>
            </li>
          `).join('')}
        </ul>
      </div>
    `
    : '<div class="top-picks"><h2>Top Picks</h2><p>No high-confidence picks for today.</p></div>';
  
  // Create summary statistics
  const totalMatches = predictions.length;
  const matchesWithRecs = predictions.filter(p => p.recommendation).length;
  const avgEdge = predictions
    .filter(p => p.recommendation)
    .reduce((sum, p) => sum + (p.recommendation?.edge || 0), 0) / (matchesWithRecs || 1);
  
  // Generate the full HTML
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Football Predictions - ${date}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
      color: #333;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    header {
      background-color: #f8f9fa;
      padding: 20px;
      margin-bottom: 20px;
      border-radius: 5px;
      border-left: 5px solid #007bff;
    }
    
    .disclaimer {
      background-color: #f8d7da;
      border-left: 5px solid #dc3545;
      padding: 10px 20px;
      margin-bottom: 20px;
      border-radius: 5px;
    }
    
    .summary {
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }
    
    .summary-box {
      background-color: #e9ecef;
      padding: 15px;
      border-radius: 5px;
      flex: 1;
      margin: 0 10px 10px 0;
      min-width: 200px;
      text-align: center;
    }
    
    .summary-box h3 {
      margin-top: 0;
      color: #495057;
    }
    
    .summary-box p {
      font-size: 24px;
      font-weight: bold;
      margin: 10px 0 0;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    
    th, td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    
    th {
      background-color: #007bff;
      color: white;
      position: sticky;
      top: 0;
    }
    
    tr:hover {
      background-color: rgba(0, 0, 0, 0.05);
    }
    
    .top-picks {
      background-color: #e9ecef;
      padding: 20px;
      border-radius: 5px;
      margin-bottom: 30px;
    }
    
    .top-picks h2 {
      margin-top: 0;
      color: #495057;
      border-bottom: 2px solid #007bff;
      padding-bottom: 10px;
    }
    
    .top-picks ul {
      padding-left: 20px;
    }
    
    .top-picks li {
      margin-bottom: 15px;
    }
    
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      color: #6c757d;
    }
    
    .download-links {
      margin-bottom: 20px;
    }
    
    .download-links a {
      display: inline-block;
      margin-right: 15px;
      background-color: #007bff;
      color: white;
      padding: 10px 15px;
      text-decoration: none;
      border-radius: 5px;
    }
    
    .download-links a:hover {
      background-color: #0069d9;
    }
    
    @media (max-width: 768px) {
      .summary-box {
        min-width: 100%;
        margin-right: 0;
      }
      
      th, td {
        padding: 8px 10px;
      }
      
      table {
        font-size: 14px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Football Match Predictions - ${date}</h1>
      <p>Automated predictions for upcoming football matches with bookmaker comparison</p>
    </header>
    
    <div class="disclaimer">
      <h3>Disclaimer</h3>
      <p>This report provides probabilistic signals only. Past performance is not a guarantee of future results. Do not risk more than you can afford to lose.</p>
    </div>
    
    <div class="summary">
      <div class="summary-box">
        <h3>Total Matches</h3>
        <p>${totalMatches}</p>
      </div>
      <div class="summary-box">
        <h3>Recommended Bets</h3>
        <p>${matchesWithRecs}</p>
      </div>
      <div class="summary-box">
        <h3>Average Edge</h3>
        <p>${(avgEdge * 100).toFixed(1)}%</p>
      </div>
    </div>
    
    ${topPicksSection}
    
    <h2>All Matches</h2>
    <table>
      <thead>
        <tr>
          <th>League</th>
          <th>Kickoff</th>
          <th>Match</th>
          <th>1X2 Probabilities</th>
          <th>BTTS Yes</th>
          <th>Over 2.5 (xG)</th>
          <th>Recommendation</th>
          <th>Edge</th>
          <th>EV</th>
        </tr>
      </thead>
      <tbody>
        ${predictionRows}
      </tbody>
    </table>
    
    <div class="download-links">
      <h3>Download Data</h3>
      <a href="summary-${date.replace(/-/g, '')}.csv" download>Download CSV</a>
      <a href="predictions-${date.replace(/-/g, '')}.json" download>Download JSON</a>
    </div>
    
    <div class="footer">
      <p>Generated on ${dayjs().format('YYYY-MM-DD HH:mm:ss')}</p>
      <p>Football Prediction System - Data sourced from Flashscore, Soccervista, and Freesupertips</p>
    </div>
  </div>
</body>
</html>
  `;
  
  // Write HTML to file
  fs.writeFileSync(outputPath, html, 'utf-8');
  console.log(`HTML report saved to ${outputPath}`);
}

/**
 * Generate reasoning text for a prediction
 * @param prediction Prediction result
 * @returns Reasoning text
 */
function generateReasoning(prediction: PredictionResult): string {
  if (!prediction.recommendation) {
    return 'No recommendation available.';
  }
  
  const bet = prediction.recommendation.bet;
  const homeTeam = prediction.home_team;
  const awayTeam = prediction.away_team;
  
  // Generate different reasoning based on bet type
  if (bet === '1') {
    return `${homeTeam} shows strong home form (${prediction.raw_features.home_form_points} points from last 5) and has a ${(prediction.model_prob_1x2.home * 100).toFixed(1)}% win probability according to our model, compared to the bookmaker's implied ${(prediction.raw_features.market_implied_prob_home * 100).toFixed(1)}%, giving a significant edge of ${(prediction.recommendation.edge * 100).toFixed(1)}%.`;
  } else if (bet === 'X') {
    return `The model predicts a high draw probability of ${(prediction.model_prob_1x2.draw * 100).toFixed(1)}% for ${homeTeam} vs ${awayTeam}, significantly higher than the market's ${(prediction.raw_features.market_implied_prob_draw * 100).toFixed(1)}%. Historical H2H shows balanced results with ${prediction.raw_features.h2h_draws} draws in recent matches.`;
  } else if (bet === '2') {
    return `${awayTeam} has strong away form (${prediction.raw_features.away_form_points} points from last 5) against ${homeTeam}'s weaker home record. Model calculates ${(prediction.model_prob_1x2.away * 100).toFixed(1)}% win probability vs market's ${(prediction.raw_features.market_implied_prob_away * 100).toFixed(1)}%, creating value.`;
  } else if (bet === 'BTTS Yes') {
    return `Both ${homeTeam} (${prediction.raw_features.home_goals_scored_avg.toFixed(1)} goals scored, ${prediction.raw_features.home_goals_conceded_avg.toFixed(1)} conceded per game) and ${awayTeam} (${prediction.raw_features.away_goals_scored_avg.toFixed(1)} scored, ${prediction.raw_features.away_goals_conceded_avg.toFixed(1)} conceded) have strong scoring records. Model predicts ${(prediction.model_prob_btts.yes * 100).toFixed(1)}% BTTS probability.`;
  } else if (bet === 'Over 2.5') {
    return `Model expects ${prediction.model_prob_over_under.expected_goals.toFixed(1)} total goals in ${homeTeam} vs ${awayTeam}, with a ${(prediction.model_prob_over_under.over_2_5 * 100).toFixed(1)}% probability of Over 2.5 goals. Both teams are averaging over ${(prediction.raw_features.home_goals_scored_avg + prediction.raw_features.away_goals_scored_avg).toFixed(1)} combined goals per game.`;
  }
  
  return `Model shows a ${(prediction.recommendation.edge * 100).toFixed(1)}% edge on this selection with ${(prediction.recommendation.confidence * 100).toFixed(1)}% confidence based on recent form and historical data.`;
}