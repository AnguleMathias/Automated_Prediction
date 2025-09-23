/**
 * Normalizer for odds and probability calculations
 */

// Interfaces
export interface Odds {
  decimal: number;
  fractional?: string;
  american?: number;
  impliedProbability: number;
}

export interface BookmakerOdds {
  bookmaker: string;
  home_win: Odds;
  draw: Odds;
  away_win: Odds;
  btts_yes?: Odds;
  btts_no?: Odds;
  over_2_5?: Odds;
  under_2_5?: Odds;
  margin: number;
  fair_home_win: Odds;
  fair_draw: Odds;
  fair_away_win: Odds;
}

/**
 * Convert decimal odds to implied probability
 * @param decimalOdds Decimal odds
 * @returns Implied probability (0-1)
 */
export function decimalToImpliedProbability(decimalOdds: number): number {
  if (!decimalOdds || decimalOdds <= 1) {
    return 0;
  }
  return 1 / decimalOdds;
}

/**
 * Convert implied probability to decimal odds
 * @param probability Implied probability (0-1)
 * @returns Decimal odds
 */
export function impliedProbabilityToDecimal(probability: number): number {
  if (!probability || probability <= 0 || probability > 1) {
    return 0;
  }
  return 1 / probability;
}

/**
 * Convert decimal odds to fractional odds string
 * @param decimalOdds Decimal odds
 * @returns Fractional odds as string (e.g., "5/2")
 */
export function decimalToFractional(decimalOdds: number): string {
  if (!decimalOdds || decimalOdds <= 1) {
    return '0/1';
  }
  
  const decimal = decimalOdds - 1;
  
  // Handle common cases
  if (Math.abs(decimal - 1/1) < 0.001) return '1/1'; // Evens
  if (Math.abs(decimal - 1/2) < 0.001) return '1/2';
  if (Math.abs(decimal - 2/1) < 0.001) return '2/1';
  if (Math.abs(decimal - 3/1) < 0.001) return '3/1';
  if (Math.abs(decimal - 4/1) < 0.001) return '4/1';
  if (Math.abs(decimal - 5/1) < 0.001) return '5/1';
  if (Math.abs(decimal - 6/1) < 0.001) return '6/1';
  if (Math.abs(decimal - 10/1) < 0.001) return '10/1';
  
  // For more complex fractions
  const tolerance = 0.001;
  let numerator = 1;
  let denominator = 1;
  
  let bestError = Math.abs(decimal - (numerator / denominator));
  let bestNumerator = numerator;
  let bestDenominator = denominator;
  
  // Find the closest fraction with denominators up to 20
  for (denominator = 1; denominator <= 20; denominator++) {
    numerator = Math.round(decimal * denominator);
    if (numerator > 0) {
      const error = Math.abs(decimal - (numerator / denominator));
      if (error < bestError) {
        bestError = error;
        bestNumerator = numerator;
        bestDenominator = denominator;
        
        if (error < tolerance) {
          break;
        }
      }
    }
  }
  
  return `${bestNumerator}/${bestDenominator}`;
}

/**
 * Convert decimal odds to American odds
 * @param decimalOdds Decimal odds
 * @returns American odds
 */
export function decimalToAmerican(decimalOdds: number): number {
  if (!decimalOdds || decimalOdds <= 1) {
    return 0;
  }
  
  if (decimalOdds >= 2) {
    // Positive American odds (underdog)
    return Math.round((decimalOdds - 1) * 100);
  } else {
    // Negative American odds (favorite)
    return Math.round(-100 / (decimalOdds - 1));
  }
}

/**
 * Create a normalized Odds object from decimal odds
 * @param decimalOdds Decimal odds
 * @returns Normalized Odds object
 */
export function createOddsObject(decimalOdds: number): Odds {
  if (!decimalOdds || decimalOdds <= 1) {
    return {
      decimal: 0,
      fractional: '0/1',
      american: 0,
      impliedProbability: 0
    };
  }
  
  return {
    decimal: decimalOdds,
    fractional: decimalToFractional(decimalOdds),
    american: decimalToAmerican(decimalOdds),
    impliedProbability: decimalToImpliedProbability(decimalOdds)
  };
}

/**
 * Calculate the bookmaker margin from a set of odds
 * @param homeOdds Home win decimal odds
 * @param drawOdds Draw decimal odds
 * @param awayOdds Away win decimal odds
 * @returns Bookmaker margin as a fraction (e.g., 0.05 for 5%)
 */
export function calculateBookmakerMargin(homeOdds: number, drawOdds: number, awayOdds: number): number {
  if (!homeOdds || !drawOdds || !awayOdds || homeOdds <= 1 || drawOdds <= 1 || awayOdds <= 1) {
    return 0;
  }
  
  const homeProb = decimalToImpliedProbability(homeOdds);
  const drawProb = decimalToImpliedProbability(drawOdds);
  const awayProb = decimalToImpliedProbability(awayOdds);
  
  const totalImpliedProbability = homeProb + drawProb + awayProb;
  
  // Bookmaker margin is how much over 100% the total implied probability is
  return totalImpliedProbability - 1;
}

/**
 * Calculate fair odds by removing the bookmaker margin
 * @param odds Array of odds
 * @param margin Bookmaker margin
 * @returns Array of fair odds
 */
export function calculateFairOdds(odds: number[], margin: number): number[] {
  if (!odds.length || margin < 0) {
    return odds;
  }
  
  const impliedProbabilities = odds.map(decimalToImpliedProbability);
  const totalImpliedProbability = impliedProbabilities.reduce((sum, prob) => sum + prob, 0);
  
  // Calculate fair probabilities by removing the margin proportionally
  const fairProbabilities = impliedProbabilities.map(prob => prob / totalImpliedProbability);
  
  // Convert back to decimal odds
  return fairProbabilities.map(impliedProbabilityToDecimal);
}

/**
 * Normalize bookmaker odds to create a complete BookmakerOdds object
 * @param bookmaker Bookmaker name
 * @param homeWinOdds Home win decimal odds
 * @param drawOdds Draw decimal odds
 * @param awayWinOdds Away win decimal odds
 * @param bttsYesOdds Both teams to score (Yes) decimal odds
 * @param bttsNoOdds Both teams to score (No) decimal odds
 * @param over25Odds Over 2.5 goals decimal odds
 * @param under25Odds Under 2.5 goals decimal odds
 * @returns Normalized BookmakerOdds object
 */
export function normalizeBookmakerOdds(
  bookmaker: string,
  homeWinOdds: number,
  drawOdds: number,
  awayWinOdds: number,
  bttsYesOdds?: number,
  bttsNoOdds?: number,
  over25Odds?: number,
  under25Odds?: number
): BookmakerOdds {
  // Calculate bookmaker margin
  const margin = calculateBookmakerMargin(homeWinOdds, drawOdds, awayWinOdds);
  
  // Calculate fair odds (removing margin)
  const [fairHomeWinOdds, fairDrawOdds, fairAwayWinOdds] = calculateFairOdds(
    [homeWinOdds, drawOdds, awayWinOdds],
    margin
  );
  
  // Create result object
  const result: BookmakerOdds = {
    bookmaker,
    home_win: createOddsObject(homeWinOdds),
    draw: createOddsObject(drawOdds),
    away_win: createOddsObject(awayWinOdds),
    margin,
    fair_home_win: createOddsObject(fairHomeWinOdds),
    fair_draw: createOddsObject(fairDrawOdds),
    fair_away_win: createOddsObject(fairAwayWinOdds)
  };
  
  // Add optional markets if provided
  if (bttsYesOdds && bttsNoOdds) {
    result.btts_yes = createOddsObject(bttsYesOdds);
    result.btts_no = createOddsObject(bttsNoOdds);
  }
  
  if (over25Odds && under25Odds) {
    result.over_2_5 = createOddsObject(over25Odds);
    result.under_2_5 = createOddsObject(under25Odds);
  }
  
  return result;
}

/**
 * Compare bookmaker odds and find the best available odds
 * @param bookmakerOddsArray Array of BookmakerOdds objects
 * @returns Object with best odds for each market
 */
export function findBestOdds(bookmakerOddsArray: BookmakerOdds[]): {
  best_home_win: { bookmaker: string; odds: Odds };
  best_draw: { bookmaker: string; odds: Odds };
  best_away_win: { bookmaker: string; odds: Odds };
  best_btts_yes?: { bookmaker: string; odds: Odds };
  best_btts_no?: { bookmaker: string; odds: Odds };
  best_over_2_5?: { bookmaker: string; odds: Odds };
  best_under_2_5?: { bookmaker: string; odds: Odds };
} {
  if (!bookmakerOddsArray.length) {
    throw new Error('No bookmaker odds provided');
  }
  
  // Initialize with first bookmaker's odds
  const result = {
    best_home_win: { bookmaker: bookmakerOddsArray[0].bookmaker, odds: bookmakerOddsArray[0].home_win },
    best_draw: { bookmaker: bookmakerOddsArray[0].bookmaker, odds: bookmakerOddsArray[0].draw },
    best_away_win: { bookmaker: bookmakerOddsArray[0].bookmaker, odds: bookmakerOddsArray[0].away_win },
  } as any;
  
  // Check if BTTS and Over/Under markets are available in first bookmaker
  if (bookmakerOddsArray[0].btts_yes && bookmakerOddsArray[0].btts_no) {
    result.best_btts_yes = { bookmaker: bookmakerOddsArray[0].bookmaker, odds: bookmakerOddsArray[0].btts_yes };
    result.best_btts_no = { bookmaker: bookmakerOddsArray[0].bookmaker, odds: bookmakerOddsArray[0].btts_no };
  }
  
  if (bookmakerOddsArray[0].over_2_5 && bookmakerOddsArray[0].under_2_5) {
    result.best_over_2_5 = { bookmaker: bookmakerOddsArray[0].bookmaker, odds: bookmakerOddsArray[0].over_2_5 };
    result.best_under_2_5 = { bookmaker: bookmakerOddsArray[0].bookmaker, odds: bookmakerOddsArray[0].under_2_5 };
  }
  
  // Compare with remaining bookmakers
  for (let i = 1; i < bookmakerOddsArray.length; i++) {
    const bookmakerOdds = bookmakerOddsArray[i];
    
    // Compare 1X2 odds
    if (bookmakerOdds.home_win.decimal > result.best_home_win.odds.decimal) {
      result.best_home_win = { bookmaker: bookmakerOdds.bookmaker, odds: bookmakerOdds.home_win };
    }
    
    if (bookmakerOdds.draw.decimal > result.best_draw.odds.decimal) {
      result.best_draw = { bookmaker: bookmakerOdds.bookmaker, odds: bookmakerOdds.draw };
    }
    
    if (bookmakerOdds.away_win.decimal > result.best_away_win.odds.decimal) {
      result.best_away_win = { bookmaker: bookmakerOdds.bookmaker, odds: bookmakerOdds.away_win };
    }
    
    // Compare BTTS odds if available
    if (bookmakerOdds.btts_yes && bookmakerOdds.btts_no) {
      if (!result.best_btts_yes || bookmakerOdds.btts_yes.decimal > result.best_btts_yes.odds.decimal) {
        result.best_btts_yes = { bookmaker: bookmakerOdds.bookmaker, odds: bookmakerOdds.btts_yes };
      }
      
      if (!result.best_btts_no || bookmakerOdds.btts_no.decimal > result.best_btts_no.odds.decimal) {
        result.best_btts_no = { bookmaker: bookmakerOdds.bookmaker, odds: bookmakerOdds.btts_no };
      }
    }
    
    // Compare Over/Under odds if available
    if (bookmakerOdds.over_2_5 && bookmakerOdds.under_2_5) {
      if (!result.best_over_2_5 || bookmakerOdds.over_2_5.decimal > result.best_over_2_5.odds.decimal) {
        result.best_over_2_5 = { bookmaker: bookmakerOdds.bookmaker, odds: bookmakerOdds.over_2_5 };
      }
      
      if (!result.best_under_2_5 || bookmakerOdds.under_2_5.decimal > result.best_under_2_5.odds.decimal) {
        result.best_under_2_5 = { bookmaker: bookmakerOdds.bookmaker, odds: bookmakerOdds.under_2_5 };
      }
    }
  }
  
  return result;
}