import { prisma } from "../db/client";
import { logger } from "../utils/logger";
import { config } from "../config";
import { BetCategory, BetType, Match, Team, Injury } from "@prisma/client";
import { oddsClient } from "../api/odds.client";

interface PredictionInput {
  match: Match & {
    homeTeam: Team & { injuries: Injury[] };
    awayTeam: Team & { injuries: Injury[] };
  };
}

interface PredictionResult {
  matchId: number;
  recommendedTeamId: number;
  betType: BetType;
  confidenceScore: number;
  category: BetCategory;
  formScore: number;
  homeAwayScore: number;
  h2hScore: number;
  injuryImpact: number;
  leagueMotivation: number;
  oddsValue: number;
  reasoning: string;
  keyFactors: string[];
}

export class PredictionEngine {
  /**
   * Generate predictions for all upcoming matches
   */
  async generateWeekendPredictions(): Promise<PredictionResult[]> {
    logger.info("Generating weekend predictions...");

    const upcomingMatches = await this.getUpcomingWeekendMatches();
    const predictions: PredictionResult[] = [];

    for (const match of upcomingMatches) {
      try {
        const prediction = await this.analyzMatch(match);
        if (
          prediction &&
          prediction.confidenceScore >= config.MIN_CONFIDENCE_THRESHOLD
        ) {
          predictions.push(prediction);
          await this.savePrediction(prediction);
        }
      } catch (error) {
        logger.error(
          { error, matchId: match.id },
          "Failed to generate prediction",
        );
      }
    }

    logger.info({ count: predictions.length }, "Predictions generated");
    return predictions.sort((a, b) => b.confidenceScore - a.confidenceScore);
  }

  /**
   * Analyze a single match and generate prediction
   */
  private async analyzMatch(
    input: PredictionInput,
  ): Promise<PredictionResult | null> {
    const { match } = input;
    const { homeTeam, awayTeam } = match;

    // Calculate individual scores
    const formScore = this.calculateFormScore(homeTeam, awayTeam);
    const homeAwayScore = this.calculateHomeAwayScore(homeTeam, awayTeam);
    const h2hScore = this.calculateH2HScore(match);
    const injuryImpact = this.calculateInjuryImpact(homeTeam, awayTeam);
    const leagueMotivation = this.calculateLeagueMotivation(homeTeam, awayTeam);

    // Calculate weighted confidence score
    const confidenceScore = this.calculateConfidenceScore({
      formScore,
      homeAwayScore,
      h2hScore,
      injuryImpact,
      leagueMotivation,
    });

    // Determine recommended team and bet type
    const recommendation = this.determineRecommendation(
      formScore,
      homeAwayScore,
      h2hScore,
      homeTeam,
      awayTeam,
    );

    if (!recommendation) return null;

    // Calculate odds value
    const oddsValue = await this.calculateOddsValue(
      match,
      recommendation.teamId,
      confidenceScore,
    );

    // Determine bet category
    const category = this.determineBetCategory(
      confidenceScore,
      oddsValue,
      match,
    );

    // Generate reasoning
    const { reasoning, keyFactors } = this.generateReasoning({
      formScore,
      homeAwayScore,
      h2hScore,
      injuryImpact,
      leagueMotivation,
      oddsValue,
      homeTeam,
      awayTeam,
      recommendedTeamId: recommendation.teamId,
    });

    return {
      matchId: match.id,
      recommendedTeamId: recommendation.teamId,
      betType: recommendation.betType,
      confidenceScore,
      category,
      formScore,
      homeAwayScore,
      h2hScore,
      injuryImpact,
      leagueMotivation,
      oddsValue,
      reasoning,
      keyFactors,
    };
  }

  /**
   * Calculate form score (based on recent results)
   */
  private calculateFormScore(homeTeam: Team, awayTeam: Team): number {
    // Form points out of 15 (5 games * 3 points max)
    const homeFormPercent = (homeTeam.formPoints / 15) * 100;
    const awayFormPercent = (awayTeam.formPoints / 15) * 100;

    // Calculate advantage
    const formDifference = homeFormPercent - awayFormPercent;

    // Normalize to 0-100 scale
    return 50 + formDifference / 2; // Clamp between 0-100
  }

  /**
   * Calculate home/away advantage score
   */
  private calculateHomeAwayScore(homeTeam: Team, awayTeam: Team): number {
    const homeAdvantage = homeTeam.homeWinRate * 100;
    const awayDisadvantage = (1 - awayTeam.awayWinRate) * 100;

    return (homeAdvantage + awayDisadvantage) / 2;
  }

  /**
   * Calculate head-to-head score
   */
  private calculateH2HScore(match: Match): number {
    const totalH2H = match.h2hHomeWins + match.h2hDraws + match.h2hAwayWins;

    if (totalH2H === 0) return 50; // No history = neutral

    const homeWinPercent = (match.h2hHomeWins / totalH2H) * 100;
    return homeWinPercent;
  }

  /**
   * Calculate injury impact (negative score for injuries)
   */
  private calculateInjuryImpact(
    homeTeam: Team & { injuries: Injury[] },
    awayTeam: Team & { injuries: Injury[] },
  ): number {
    const homeInjuryScore = this.getTeamInjuryScore(homeTeam.injuries);
    const awayInjuryScore = this.getTeamInjuryScore(awayTeam.injuries);

    // Higher score = less impact = better
    const impactDifference = awayInjuryScore - homeInjuryScore;

    return 50 + impactDifference * 10; // Scale to 0-100
  }

  private getTeamInjuryScore(injuries: Injury[]): number {
    return injuries.reduce((score, injury) => {
      switch (injury.severity) {
        case "SEVERE":
          return score + 3;
        case "MODERATE":
          return score + 2;
        case "MINOR":
          return score + 1;
        case "DOUBTFUL":
          return score + 0.5;
        default:
          return score;
      }
    }, 0);
  }

  /**
   * Calculate league motivation (title race, relegation battle)
   */
  private calculateLeagueMotivation(homeTeam: Team, awayTeam: Team): number {
    // Teams in top 4 or bottom 3 have higher motivation
    const homeMotivation = this.getMotivationScore(homeTeam.position || 10);
    const awayMotivation = this.getMotivationScore(awayTeam.position || 10);

    return homeMotivation - awayMotivation + 50; // Scale to 0-100
  }

  private getMotivationScore(position: number): number {
    if (position <= 4) return 10; // Title/Champions League race
    if (position >= 17) return 10; // Relegation battle
    return 5; // Mid-table
  }

  /**
   * Calculate overall confidence score with weights
   */
  private calculateConfidenceScore(scores: {
    formScore: number;
    homeAwayScore: number;
    h2hScore: number;
    injuryImpact: number;
    leagueMotivation: number;
  }): number {
    const weighted =
      scores.formScore * config.FORM_WEIGHT +
      scores.homeAwayScore * config.HOME_AWAY_WEIGHT +
      scores.h2hScore * config.HEAD_TO_HEAD_WEIGHT +
      scores.injuryImpact * config.INJURY_WEIGHT +
      scores.leagueMotivation * config.LEAGUE_POSITION_WEIGHT;

    return Math.max(0, Math.min(100, Math.round(weighted)));
  }

  /**
   * Determine which team to recommend and bet type
   */
  private determineRecommendation(
    formScore: number,
    homeAwayScore: number,
    h2hScore: number,
    homeTeam: Team,
    awayTeam: Team,
  ): { teamId: number; betType: BetType } | null {
    // If home team has clear advantage
    if (formScore > 60 && homeAwayScore > 60) {
      return { teamId: homeTeam.id, betType: BetType.HOME_WIN };
    }

    // If away team surprisingly strong
    if (formScore < 40 && h2hScore < 40) {
      return { teamId: awayTeam.id, betType: BetType.AWAY_WIN };
    }

    // Check goal scoring patterns
    if (homeTeam.avgGoalsScored > 1.5 && awayTeam.avgGoalsScored > 1.5) {
      return { teamId: homeTeam.id, betType: BetType.BTTS };
    }

    // Default to home win if moderate advantage
    if (formScore >= 50 && homeAwayScore >= 50) {
      return { teamId: homeTeam.id, betType: BetType.HOME_WIN };
    }

    return null; // No clear recommendation
  }

  /**
   * Calculate odds value
   */
  private async calculateOddsValue(
    match: Match,
    recommendedTeamId: number,
    confidenceScore: number,
  ): Promise<number> {
    if (!match.homeOdds || !match.awayOdds) return 0;

    const odds =
      recommendedTeamId === match.homeTeamId ? match.homeOdds : match.awayOdds;
    const estimatedProbability = confidenceScore / 100;

    const valueAnalysis = oddsClient.calculateValueBet(
      odds,
      estimatedProbability,
    );

    return valueAnalysis.isValue ? valueAnalysis.expectedValue * 100 : 0;
  }

  /**
   * Determine bet category
   */
  private determineBetCategory(
    confidenceScore: number,
    oddsValue: number,
    match: Match,
  ): BetCategory {
    const odds = match.homeOdds || 2.0;

    // High confidence + low odds = safe bet
    if (confidenceScore >= 75 && odds <= 2.0) {
      return BetCategory.SAFE_BET;
    }

    // Medium confidence + good value = value bet
    if (confidenceScore >= 60 && confidenceScore < 75 && oddsValue > 10) {
      return BetCategory.VALUE_BET;
    }

    // Lower confidence or high odds = risky
    if (confidenceScore >= 60 && confidenceScore < 70 && odds > 3.0) {
      return BetCategory.RISKY_BET;
    }

    // Default to value bet
    return BetCategory.VALUE_BET;
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(data: any): {
    reasoning: string;
    keyFactors: string[];
  } {
    const keyFactors: string[] = [];
    const reasons: string[] = [];

    const {
      homeTeam,
      awayTeam,
      recommendedTeamId,
      formScore,
      homeAwayScore,
      h2hScore,
      injuryImpact,
    } = data;
    const recommendedTeam =
      recommendedTeamId === homeTeam.id ? homeTeam : awayTeam;

    if (formScore > 60) {
      reasons.push(`${recommendedTeam.name} has superior recent form`);
      keyFactors.push("Excellent Form");
    }

    if (homeAwayScore > 65 && recommendedTeamId === homeTeam.id) {
      reasons.push(`Strong home advantage for ${homeTeam.name}`);
      keyFactors.push("Home Advantage");
    }

    if (h2hScore > 60) {
      reasons.push(`Favorable head-to-head record`);
      keyFactors.push("H2H Dominance");
    }

    if (injuryImpact > 60) {
      reasons.push(`Opposition has key injury concerns`);
      keyFactors.push("Injury Advantage");
    }

    const reasoning =
      reasons.length > 0
        ? reasons.join(". ") + "."
        : `Based on statistical analysis, ${recommendedTeam.name} has a favorable profile for this match.`;

    return { reasoning, keyFactors };
  }

  /**
   * Get upcoming weekend matches
   */
  private async getUpcomingWeekendMatches() {
    // Get today's matches only
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    logger.info(
      { date: today.toISOString() },
      "Fetching today's matches for prediction",
    );

    return prisma.match.findMany({
      where: {
        startTime: {
          gte: today,
          lt: tomorrow,
        },
        status: "SCHEDULED",
        league: {
          name: "Premier League",
        },
      },
      include: {
        homeTeam: {
          include: { injuries: true },
        },
        awayTeam: {
          include: { injuries: true },
        },
        league: true,
      },
    });
  }

  /**
   * Save prediction to database
   */
  private async savePrediction(prediction: PredictionResult): Promise<void> {
    await prisma.prediction.upsert({
      where: { matchId: prediction.matchId },
      create: {
        matchId: prediction.matchId,
        recommendedTeamId: prediction.recommendedTeamId,
        betType: prediction.betType,
        confidenceScore: prediction.confidenceScore,
        category: prediction.category,
        formScore: prediction.formScore,
        homeAwayScore: prediction.homeAwayScore,
        h2hScore: prediction.h2hScore,
        injuryImpact: prediction.injuryImpact,
        leagueMotivation: prediction.leagueMotivation,
        oddsValue: prediction.oddsValue,
        reasoning: prediction.reasoning,
        keyFactors: prediction.keyFactors,
        isActive: true,
      },
      update: {
        recommendedTeamId: prediction.recommendedTeamId,
        betType: prediction.betType,
        confidenceScore: prediction.confidenceScore,
        category: prediction.category,
        formScore: prediction.formScore,
        homeAwayScore: prediction.homeAwayScore,
        h2hScore: prediction.h2hScore,
        injuryImpact: prediction.injuryImpact,
        leagueMotivation: prediction.leagueMotivation,
        oddsValue: prediction.oddsValue,
        reasoning: prediction.reasoning,
        keyFactors: prediction.keyFactors,
        isActive: true,
      },
    });
  }
}

export const predictionEngine = new PredictionEngine();
