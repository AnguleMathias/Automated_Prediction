import axios, { AxiosInstance } from "axios";
import { config } from "../config";
import { logger } from "../utils/logger";
import { cache } from "../utils/cache";

interface OddsData {
  home: number;
  draw: number;
  away: number;
  bookmaker: string;
  timestamp: number;
}

export class OddsClient {
  private client: AxiosInstance | null = null;
  private isEnabled: boolean = false;

  constructor() {
    if (config.ODDS_API_KEY) {
      this.client = axios.create({
        baseURL: config.ODDS_API_BASE,
        timeout: 10000,
        headers: {
          Accept: "application/json",
        },
        params: {
          apiKey: config.ODDS_API_KEY,
        },
      });
      this.isEnabled = true;
    } else {
      logger.warn("Odds API key not configured, odds fetching disabled");
    }
  }

  /**
   * Fetch odds for a specific match
   * Note: This uses The Odds API structure. Adjust based on your chosen provider.
   */
  async getMatchOdds(
    homeTeam: string,
    awayTeam: string,
    startTime: Date,
  ): Promise<OddsData | null> {
    if (!this.isEnabled || !this.client) {
      // Return mock odds for development
      return this.getMockOdds();
    }

    const cacheKey = `odds:${homeTeam}:${awayTeam}:${startTime.toISOString()}`;

    // Check cache
    const cached = await cache.get<OddsData>(cacheKey);
    if (cached) return cached;

    try {
      // This is a placeholder structure - adjust to your actual API
      const response = await this.client.get("/odds", {
        params: {
          sport: "soccer",
          regions: "eu",
          markets: "h2h",
          dateFormat: "iso",
        },
      });

      // Parse and find matching match
      const matchData = response.data?.data?.find(
        (match: any) =>
          match.home_team === homeTeam && match.away_team === awayTeam,
      );

      if (!matchData || !matchData.bookmakers?.[0]?.markets?.[0]?.outcomes) {
        return this.getMockOdds();
      }

      const outcomes = matchData.bookmakers[0].markets[0].outcomes;
      const homeOdds =
        outcomes.find((o: any) => o.name === homeTeam)?.price || 2.0;
      const awayOdds =
        outcomes.find((o: any) => o.name === awayTeam)?.price || 2.0;
      const drawOdds =
        outcomes.find((o: any) => o.name === "Draw")?.price || 3.5;

      const oddsData: OddsData = {
        home: homeOdds,
        draw: drawOdds,
        away: awayOdds,
        bookmaker: matchData.bookmakers[0].title,
        timestamp: Date.now(),
      };

      await cache.set(cacheKey, oddsData, 1800); // 30 min cache
      return oddsData;
    } catch (error) {
      logger.error({ error, homeTeam, awayTeam }, "Failed to fetch odds");
      return this.getMockOdds();
    }
  }

  /**
   * Calculate if odds represent value
   * @param odds - Decimal odds (e.g., 2.5)
   * @param probability - Estimated win probability (0-1)
   */
  calculateValueBet(
    odds: number,
    probability: number,
  ): {
    isValue: boolean;
    expectedValue: number;
  } {
    const impliedProbability = 1 / odds;
    const expectedValue = odds * probability - 1;
    const isValue = probability > impliedProbability && expectedValue > 0.1; // 10% edge

    return { isValue, expectedValue };
  }

  /**
   * Get average odds from multiple bookmakers (if available)
   */
  async getAverageOdds(
    homeTeam: string,
    awayTeam: string,
    startTime: Date,
  ): Promise<OddsData | null> {
    // For now, just return single odds
    // In production, you'd fetch from multiple sources and average them
    return this.getMatchOdds(homeTeam, awayTeam, startTime);
  }

  /**
   * Mock odds for development/testing
   */
  private getMockOdds(): OddsData {
    return {
      home: 1.8 + Math.random() * 2, // 1.8 - 3.8
      draw: 3.2 + Math.random() * 1.5, // 3.2 - 4.7
      away: 1.9 + Math.random() * 2, // 1.9 - 3.9
      bookmaker: "Mock Bookmaker",
      timestamp: Date.now(),
    };
  }

  /**
   * Convert decimal odds to implied probability
   */
  oddsToProbability(odds: number): number {
    return 1 / odds;
  }

  /**
   * Convert probability to decimal odds
   */
  probabilityToOdds(probability: number): number {
    return 1 / probability;
  }

  /**
   * Calculate odds margin (bookmaker's edge)
   */
  calculateMargin(
    homeOdds: number,
    drawOdds: number,
    awayOdds: number,
  ): number {
    const totalProbability =
      this.oddsToProbability(homeOdds) +
      this.oddsToProbability(drawOdds) +
      this.oddsToProbability(awayOdds);

    return (totalProbability - 1) * 100; // Return as percentage
  }
}

export const oddsClient = new OddsClient();
