import { Router, Request, Response } from "express";
import { prisma } from "../db/client";
import { predictionEngine } from "../services/prediction.service";
import { dataIngestionService } from "../services/ingestion.service";
import { logger } from "../utils/logger";

const router = Router();

/**
 * @openapi
 * /api/predictions/weekend:
 *   get:
 *     summary: Get weekend match predictions
 *     description: Returns predictions for all upcoming weekend matches with optional filtering by confidence, category, and league
 *     tags: [Predictions]
 *     parameters:
 *       - $ref: '#/components/parameters/MinConfidence'
 *       - $ref: '#/components/parameters/Category'
 *       - $ref: '#/components/parameters/League'
 *     responses:
 *       200:
 *         description: List of predictions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 predictions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Prediction'
 *                 count:
 *                   type: integer
 *                   example: 25
 *                 filters:
 *                   type: object
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
/**
 * GET /api/predictions/weekend
 * Get all predictions for the upcoming weekend
 */
router.get("/predictions/weekend", async (req: Request, res: Response) => {
  try {
    const minConfidence = req.query.minConfidence
      ? parseFloat(req.query.minConfidence as string)
      : 60;

    const category = req.query.category as string | undefined;

    const predictions = await prisma.prediction.findMany({
      where: {
        isActive: true,
        confidenceScore: { gte: minConfidence },
        ...(category && { category: category as any }),
        match: {
          startTime: {
            gte: getNextFriday(),
            lte: getNextMonday(),
          },
          status: "SCHEDULED",
        },
      },
      include: {
        match: {
          include: {
            homeTeam: true,
            awayTeam: true,
            league: true,
          },
        },
        recommendedTeam: true,
      },
      orderBy: {
        confidenceScore: "desc",
      },
    });

    // Format response
    const formatted = predictions.map((p) => ({
      id: p.id,
      match: {
        id: p.match.id,
        homeTeam: p.match.homeTeam.name,
        awayTeam: p.match.awayTeam.name,
        league: p.match.league.name,
        startTime: p.match.startTime,
        odds: {
          home: p.match.homeOdds,
          draw: p.match.drawOdds,
          away: p.match.awayOdds,
        },
      },
      recommendation: {
        team: p.recommendedTeam.name,
        betType: p.betType,
        confidenceScore: p.confidenceScore,
        category: p.category,
      },
      analysis: {
        formScore: p.formScore,
        homeAwayScore: p.homeAwayScore,
        h2hScore: p.h2hScore,
        injuryImpact: p.injuryImpact,
        leagueMotivation: p.leagueMotivation,
        oddsValue: p.oddsValue,
      },
      reasoning: p.reasoning,
      keyFactors: p.keyFactors,
      generatedAt: p.generatedAt,
    }));

    res.json({
      success: true,
      count: formatted.length,
      data: formatted,
      disclaimer:
        "This is for informational purposes only. Always gamble responsibly and within your means. Past performance does not guarantee future results.",
    });
  } catch (error) {
    logger.error({ error }, "Failed to fetch weekend predictions");
    res.status(500).json({
      success: false,
      error: "Failed to fetch predictions",
    });
  }
});

/**
 * @openapi
 * /api/predictions/{matchId}:
 *   get:
 *     summary: Get prediction for a specific match
 *     description: Retrieves detailed prediction information for a single match including team stats, odds, and reasoning
 *     tags: [Predictions]
 *     parameters:
 *       - $ref: '#/components/parameters/MatchId'
 *     responses:
 *       200:
 *         description: Prediction details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Prediction'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
/**
 * GET /api/predictions/:matchId
 * Get prediction for a specific match
 */
router.get("/predictions/:matchId", async (req: Request, res: Response) => {
  try {
    const matchId = parseInt(req.params.matchId);

    const prediction = await prisma.prediction.findUnique({
      where: { matchId },
      include: {
        match: {
          include: {
            homeTeam: { include: { injuries: true } },
            awayTeam: { include: { injuries: true } },
            league: true,
          },
        },
        recommendedTeam: true,
      },
    });

    if (!prediction) {
      return res.status(404).json({
        success: false,
        error: "Prediction not found",
      });
    }

    res.json({
      success: true,
      data: {
        match: {
          homeTeam: prediction.match.homeTeam.name,
          awayTeam: prediction.match.awayTeam.name,
          league: prediction.match.league.name,
          startTime: prediction.match.startTime,
          odds: {
            home: prediction.match.homeOdds,
            draw: prediction.match.drawOdds,
            away: prediction.match.awayOdds,
          },
        },
        recommendation: {
          team: prediction.recommendedTeam.name,
          betType: prediction.betType,
          confidenceScore: prediction.confidenceScore,
          category: prediction.category,
        },
        detailedAnalysis: {
          formScore: prediction.formScore,
          homeAwayScore: prediction.homeAwayScore,
          h2hScore: prediction.h2hScore,
          injuryImpact: prediction.injuryImpact,
          leagueMotivation: prediction.leagueMotivation,
          oddsValue: prediction.oddsValue,
        },
        reasoning: prediction.reasoning,
        keyFactors: prediction.keyFactors,
        teamStatistics: {
          homeTeam: {
            form: prediction.match.homeTeam.formPoints,
            homeWinRate: prediction.match.homeTeam.homeWinRate,
            avgGoalsScored: prediction.match.homeTeam.avgGoalsScored,
            injuries: prediction.match.homeTeam.injuries.length,
          },
          awayTeam: {
            form: prediction.match.awayTeam.formPoints,
            awayWinRate: prediction.match.awayTeam.awayWinRate,
            avgGoalsScored: prediction.match.awayTeam.avgGoalsScored,
            injuries: prediction.match.awayTeam.injuries.length,
          },
        },
        generatedAt: prediction.generatedAt,
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to fetch match prediction");
    res.status(500).json({
      success: false,
      error: "Failed to fetch prediction",
    });
  }
});

/**
 * @openapi
 * /api/matches/upcoming:
 *   get:
 *     summary: Get upcoming matches
 *     description: Returns all scheduled matches for the upcoming weekend
 *     tags: [Matches]
 *     responses:
 *       200:
 *         description: List of upcoming matches
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Match'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
/**
 * GET /api/matches/upcoming
 * Get all upcoming matches
 */
router.get("/matches/upcoming", async (req: Request, res: Response) => {
  try {
    const matches = await prisma.match.findMany({
      where: {
        startTime: { gte: new Date() },
        status: "SCHEDULED",
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        league: true,
      },
      orderBy: {
        startTime: "asc",
      },
      take: 50,
    });

    res.json({
      success: true,
      count: matches.length,
      data: matches.map((m) => ({
        id: m.id,
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        league: m.league.name,
        startTime: m.startTime,
        odds: {
          home: m.homeOdds,
          draw: m.drawOdds,
          away: m.awayOdds,
        },
      })),
    });
  } catch (error) {
    logger.error({ error }, "Failed to fetch upcoming matches");
    res.status(500).json({
      success: false,
      error: "Failed to fetch matches",
    });
  }
});

/**
 * POST /api/data/refresh
 * Manually trigger data refresh and prediction generation
 */
router.post("/data/refresh", async (req: Request, res: Response) => {
  try {
    logger.info("Manual data refresh triggered");

    // Fetch matches
    await dataIngestionService.fetchUpcomingWeekendMatches();

    // Generate predictions
    const predictions = await predictionEngine.generateWeekendPredictions();

    res.json({
      success: true,
      message: "Data refreshed successfully",
      predictionsGenerated: predictions.length,
    });
  } catch (error) {
    logger.error({ error }, "Failed to refresh data");
    res.status(500).json({
      success: false,
      error: "Failed to refresh data",
    });
  }
});

/** * @openapi
 * /api/stats/summary:
 *   get:
 *     summary: Get system statistics
 *     description: Returns overall system statistics including prediction counts, averages, and data coverage
 *     tags: [Statistics]
 *     responses:
 *       200:
 *         description: System statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Statistics'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
/** * GET /api/stats/summary
 * Get summary statistics
 */
router.get("/stats/summary", async (req: Request, res: Response) => {
  try {
    const [totalMatches, totalPredictions, avgConfidence] = await Promise.all([
      prisma.match.count({
        where: {
          startTime: { gte: getNextFriday(), lte: getNextMonday() },
          status: "SCHEDULED",
        },
      }),
      prisma.prediction.count({ where: { isActive: true } }),
      prisma.prediction.aggregate({
        where: { isActive: true },
        _avg: { confidenceScore: true },
      }),
    ]);

    const categoryCounts = await prisma.prediction.groupBy({
      by: ["category"],
      where: { isActive: true },
      _count: true,
    });

    res.json({
      success: true,
      data: {
        upcomingMatches: totalMatches,
        activePredictions: totalPredictions,
        averageConfidence:
          avgConfidence._avg.confidenceScore?.toFixed(1) || "0",
        predictionsByCategory: categoryCounts.reduce((acc: any, item) => {
          acc[item.category] = item._count;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to fetch stats");
    res.status(500).json({
      success: false,
      error: "Failed to fetch statistics",
    });
  }
});

// Helper functions
function getNextFriday(): Date {
  const date = new Date();
  const day = date.getDay();
  const daysUntilFriday = (5 - day + 7) % 7;
  date.setDate(date.getDate() + (daysUntilFriday === 0 ? 7 : daysUntilFriday));
  date.setHours(0, 0, 0, 0);
  return date;
}

function getNextMonday(): Date {
  const friday = getNextFriday();
  const monday = new Date(friday);
  monday.setDate(monday.getDate() + 3);
  monday.setHours(23, 59, 59, 999);
  return monday;
}

export default router;
