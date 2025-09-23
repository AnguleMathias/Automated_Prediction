# Football Match Prediction & Odds Comparison System

An automated prediction & benchmarking pipeline that scrapes match data and odds from public football sites, normalizes and aggregates features, provides predictions, compares bookmaker odds, and outputs color-coded HTML reports.

## Features

- Scrapes match event data from multiple sources (Flashscore, Soccervista, FreeSupertips)
- Scrapes odds from Kenyan bookmakers (Mozzart, Betika, SportPesa)
- Normalizes odds and computes implied probabilities
- Produces predictions for 1X2, GG (both teams to score), and total goals
- Outputs JSON data, color-coded HTML reports, and CSV summaries
- Includes backtesting functionality

## Project Structure

```
/project
  /src
    index.ts            # orchestrator
    scrapers/
      flashscore.ts
      soccervista.ts
      freesupertips.ts
      bookmakers/
        mozzart.ts
        betika.ts
        sportpesa.ts
    normalize.ts
    model/
      features.ts
      predict.ts        # calls model or simple logistic ensemble
    output/
      htmlRenderer.ts
      csvWriter.ts
    utils/
      http.ts
      rateLimiter.ts
  package.json
  tsconfig.json
```

## Installation

```bash
# Clone the repository
git clone [repository-url]

# Install dependencies
npm install
```

## Usage

```bash
# Build the project
npm run build

# Run the full pipeline
npm start

# Run specific parts
npm run scrape     # Only scrape data
npm run predict    # Only generate predictions
npm run report     # Only generate reports
npm run backtest   # Run backtesting
```

## Configuration

Create a `.env` file in the root directory with the following variables:

```
# Scraping configuration
RATE_LIMIT_MS=400
USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36

# Prediction model configuration
EDGE_THRESHOLD=0.08
CONFIDENCE_THRESHOLD=0.65
```

## Disclaimer

This tool provides probabilistic signals only. Past performance is not a guarantee of future results. Do not risk more than you can afford to lose.

## Ethics & Legal Considerations

- Always respect robots.txt and rate-limit scraping
- Respect terms of service of all websites
- Ensure compliance with Kenyan gambling regulations