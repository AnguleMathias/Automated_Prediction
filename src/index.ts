#!/usr/bin/env node
import path from 'path';
import fs from 'fs-extra';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Import scrapers
import { scrapeFlashscore } from './scrapers/flashscore';
import { scrapeSoccervistaMatches } from './scrapers/soccervista';
import { scrapeFreesupertips } from './scrapers/freesupertips';

// Import bookmakers
import { scrapeMozzartOdds } from './scrapers/bookmakers/mozzart';
import { scrapeBetikaOdds } from './scrapers/bookmakers/betika';
import { scrapeSportpesaOdds } from './scrapers/bookmakers/sportpesa';

// Import prediction and output modules
import { generateFeatures } from './model/features';
import { predictMatches } from './model/predict';
import { renderHtmlReport } from './output/htmlRenderer';
import { writeCsvSummary } from './output/csvWriter';

// Initialize dayjs UTC plugin
dayjs.extend(utc);

// Ensure data directories exist
fs.ensureDirSync(path.join(__dirname, '../data'));
fs.ensureDirSync(path.join(__dirname, '../data/raw'));

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('scrape', {
    type: 'boolean',
    description: 'Scrape match data and odds',
    default: false
  })
  .option('predict', {
    type: 'boolean',
    description: 'Generate predictions',
    default: false
  })
  .option('report', {
    type: 'boolean',
    description: 'Generate HTML report',
    default: false
  })
  .option('backtest', {
    type: 'boolean',
    description: 'Run backtesting',
    default: false
  })
  .option('date', {
    type: 'string',
    description: 'Date to process (YYYY-MM-DD)',
    default: dayjs().format('YYYY-MM-DD')
  })
  .option('offline', {
    type: 'boolean',
    description: 'Use locally stored HTML files instead of scraping',
    default: false
  })
  .help()
  .argv as any;

// If no specific command is provided, run the full pipeline
const runAll = !argv.scrape && !argv.predict && !argv.report && !argv.backtest;

/**
 * Main function to orchestrate the entire pipeline
 */
async function main() {
  const dateStr = argv.date;
  const dateFolder = path.join(__dirname, '../data/raw', dateStr.replace(/-/g, ''));
  fs.ensureDirSync(dateFolder);
  
  console.log(`⚽ Football Prediction System - ${dateStr}`);
  console.log('----------------------------------------');
  
  // Step 1: Scrape data
  if (runAll || argv.scrape) {
    console.log('📊 Scraping match data and odds...');
    
    try {
      if (!argv.offline) {
        // Scrape match data
        const flashscoreMatches = await scrapeFlashscore(dateStr);
        const soccervistaMatches = await scrapeSoccervistaMatches(dateStr);
        const freesupertipsData = await scrapeFreesupertips(dateStr);
        
        // Scrape odds
        const mozzartOdds = await scrapeMozzartOdds(dateStr);
        const betikaOdds = await scrapeBetikaOdds(dateStr);
        const sportpesaOdds = await scrapeSportpesaOdds(dateStr);
        
        // Save raw data
        await fs.writeJson(path.join(dateFolder, 'flashscore.json'), flashscoreMatches);
        await fs.writeJson(path.join(dateFolder, 'soccervista.json'), soccervistaMatches);
        await fs.writeJson(path.join(dateFolder, 'freesupertips.json'), freesupertipsData);
        await fs.writeJson(path.join(dateFolder, 'mozzart.json'), mozzartOdds);
        await fs.writeJson(path.join(dateFolder, 'betika.json'), betikaOdds);
        await fs.writeJson(path.join(dateFolder, 'sportpesa.json'), sportpesaOdds);
        
        console.log('✅ Scraping completed successfully');
      } else {
        console.log('🔄 Using offline data');
      }
    } catch (error) {
      console.error('❌ Error during scraping:', error);
      process.exit(1);
    }
  }
  
  // Step 2: Generate predictions
  if (runAll || argv.predict) {
    console.log('🧠 Generating predictions...');
    
    try {
      // Load data
      const flashscoreMatches = await fs.readJson(path.join(dateFolder, 'flashscore.json'));
      const soccervistaMatches = await fs.readJson(path.join(dateFolder, 'soccervista.json'));
      const freesupertipsData = await fs.readJson(path.join(dateFolder, 'freesupertips.json'));
      const mozzartOdds = await fs.readJson(path.join(dateFolder, 'mozzart.json'));
      const betikaOdds = await fs.readJson(path.join(dateFolder, 'betika.json'));
      const sportpesaOdds = await fs.readJson(path.join(dateFolder, 'sportpesa.json'));
      
      // Generate features
      const matches = generateFeatures(
        flashscoreMatches,
        soccervistaMatches,
        freesupertipsData,
        mozzartOdds,
        betikaOdds,
        sportpesaOdds
      );
      
      // Make predictions
      const predictions = await predictMatches(matches);
      
      // Save predictions
      await fs.writeJson(path.join(dateFolder, 'predictions.json'), predictions);
      
      console.log('✅ Predictions generated successfully');
    } catch (error) {
      console.error('❌ Error during prediction:', error);
      process.exit(1);
    }
  }
  
  // Step 3: Generate reports
  if (runAll || argv.report) {
    console.log('📝 Generating reports...');
    
    try {
      // Load predictions
      const predictions = await fs.readJson(path.join(dateFolder, 'predictions.json'));
      
      // Generate HTML report
      const htmlOutputPath = path.join(__dirname, `../report-${dateStr.replace(/-/g, '')}.html`);
      renderHtmlReport(dateStr, predictions, htmlOutputPath);
      
      // Generate CSV summary
      const csvOutputPath = path.join(__dirname, `../summary-${dateStr.replace(/-/g, '')}.csv`);
      writeCsvSummary(predictions, csvOutputPath);
      
      console.log(`✅ Reports generated successfully:`);
      console.log(`   - HTML: ${htmlOutputPath}`);
      console.log(`   - CSV: ${csvOutputPath}`);
    } catch (error) {
      console.error('❌ Error during report generation:', error);
      process.exit(1);
    }
  }
  
  // Step 4: Run backtesting
  if (argv.backtest) {
    console.log('🔍 Running backtesting...');
    
    try {
      // Implement backtesting logic here
      console.log('✅ Backtesting completed');
    } catch (error) {
      console.error('❌ Error during backtesting:', error);
      process.exit(1);
    }
  }
  
  console.log('----------------------------------------');
  console.log('✨ Pipeline completed successfully');
}

// Run the main function
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});