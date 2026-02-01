import cron from "node-cron";
import { config } from "../config";
import { logger } from "../utils/logger";
import { dataIngestionService } from "../services/ingestion.service";
import { predictionEngine } from "../services/prediction.service";
import { prisma } from "../db/client";

export function startScheduler(): void {
  logger.info({ schedule: config.DATA_FETCH_CRON }, "Scheduler initialized");

  // Main data fetch and prediction job (default: Every Friday at 9 AM)
  cron.schedule(config.DATA_FETCH_CRON, async () => {
    logger.info("Running scheduled data fetch and prediction generation...");

    try {
      // Step 1: Fetch upcoming weekend matches
      await dataIngestionService.fetchUpcomingWeekendMatches();

      // Step 2: Update team statistics for all teams in upcoming matches
      const upcomingMatches = await prisma.match.findMany({
        where: {
          startTime: {
            gte: new Date(),
          },
          status: "SCHEDULED",
        },
        include: {
          homeTeam: true,
          awayTeam: true,
        },
        take: 100,
      });

      // Update team stats
      const teamIds = new Set<number>();
      upcomingMatches.forEach((match) => {
        teamIds.add(match.homeTeamId);
        teamIds.add(match.awayTeamId);
      });

      logger.info({ teams: teamIds.size }, "Updating team statistics");

      for (const teamId of Array.from(teamIds)) {
        await dataIngestionService.updateTeamStatistics(teamId);
        await dataIngestionService.updateTeamInjuries(teamId);
      }

      // Step 3: Generate predictions
      const predictions = await predictionEngine.generateWeekendPredictions();

      logger.info(
        {
          matchesUpdated: upcomingMatches.length,
          teamsUpdated: teamIds.size,
          predictionsGenerated: predictions.length,
        },
        "Scheduled job completed successfully",
      );

      // Step 4: Create weekend snapshot
      await createWeekendSnapshot(predictions.length);
    } catch (error) {
      logger.error({ error }, "Scheduled job failed");
    }
  });

  // Daily injury update (every day at 8 AM)
  cron.schedule("0 8 * * *", async () => {
    logger.info("Running daily injury update...");

    try {
      const teams = await prisma.team.findMany({
        select: { id: true },
      });

      for (const team of teams) {
        await dataIngestionService.updateTeamInjuries(team.id);
      }

      logger.info({ teams: teams.length }, "Daily injury update completed");
    } catch (error) {
      logger.error({ error }, "Daily injury update failed");
    }
  });

  // Odds refresh (every 6 hours during weekend)
  cron.schedule("0 */6 * * 5,6,0", async () => {
    logger.info("Refreshing weekend odds...");

    try {
      const upcomingMatches = await prisma.match.findMany({
        where: {
          startTime: {
            gte: new Date(),
            lte: new Date(Date.now() + 72 * 60 * 60 * 1000), // Next 72 hours
          },
          status: "SCHEDULED",
        },
        include: {
          homeTeam: true,
          awayTeam: true,
        },
      });

      logger.info(
        { matches: upcomingMatches.length },
        "Refreshing odds for matches",
      );

      // Note: Implement odds refresh logic here if needed
    } catch (error) {
      logger.error({ error }, "Odds refresh failed");
    }
  });

  logger.info("All cron jobs scheduled successfully");
}

async function createWeekendSnapshot(predictionsCount: number): Promise<void> {
  try {
    const friday = new Date();
    friday.setDate(friday.getDate() + ((5 - friday.getDay() + 7) % 7));
    friday.setHours(0, 0, 0, 0);

    const sunday = new Date(friday);
    sunday.setDate(sunday.getDate() + 2);
    sunday.setHours(23, 59, 59, 999);

    const matches = await prisma.match.count({
      where: {
        startTime: { gte: friday, lte: sunday },
        status: "SCHEDULED",
      },
    });

    const avgConfidence = await prisma.prediction.aggregate({
      where: { isActive: true },
      _avg: { confidenceScore: true },
    });

    await prisma.weekendSnapshot.create({
      data: {
        weekStart: friday,
        weekEnd: sunday,
        totalMatches: matches,
        totalPredictions: predictionsCount,
        avgConfidence: avgConfidence._avg.confidenceScore || 0,
        metadata: {
          generatedAt: new Date().toISOString(),
        },
      },
    });

    logger.info("Weekend snapshot created");
  } catch (error) {
    logger.error({ error }, "Failed to create weekend snapshot");
  }
}
