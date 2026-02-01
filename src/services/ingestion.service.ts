import { prisma } from "../db/client";
import { sportmonksClient } from "../api/sportmonks.client";
import { oddsClient } from "../api/odds.client";
import { logger } from "../utils/logger";
import { InjurySeverity, MatchStatus } from "@prisma/client";

export class DataIngestionService {
  /**
   * Fetch and store today's Premier League matches
   */
  async fetchUpcomingWeekendMatches(): Promise<void> {
    logger.info("Fetching today's Premier League matches from Sportmonks...");

    try {
      const matches = await sportmonksClient.getTodaysPremierLeagueMatches();

      logger.info(
        { count: matches.length },
        "Fetched Premier League matches for today",
      );

      if (matches.length === 0) {
        logger.warn("No Premier League matches scheduled for today");
        return;
      }

      for (const match of matches) {
        await this.processMatch(match);
      }

      // Update team statistics for all teams involved
      await this.updateAllTeamStatistics();

      logger.info("Today's Premier League matches ingestion completed");
    } catch (error) {
      logger.error({ error }, "Failed to fetch today's Premier League matches");
      throw error;
    }
  }

  /**
   * Process and store a single match from Sportmonks
   */
  private async processMatch(matchData: any): Promise<void> {
    try {
      // Ensure league exists
      const league = await this.ensureLeague(matchData.league);

      // Ensure teams exist (Sportmonks uses participants array)
      const homeParticipant = matchData.participants.find(
        (p: any) => p.meta.location === "home",
      );
      const awayParticipant = matchData.participants.find(
        (p: any) => p.meta.location === "away",
      );

      if (!homeParticipant || !awayParticipant) {
        logger.warn({ matchId: matchData.id }, "Match missing participants");
        return;
      }

      const homeTeam = await this.ensureTeam(homeParticipant, league.id);
      const awayTeam = await this.ensureTeam(awayParticipant, league.id);

      // Fetch odds
      const matchDate = new Date(matchData.starting_at);
      const odds = await oddsClient.getMatchOdds(
        homeParticipant.name,
        awayParticipant.name,
        matchDate,
      );

      // Fetch head-to-head from Sportmonks
      const h2h = await sportmonksClient.getHeadToHead(
        homeParticipant.id,
        awayParticipant.id,
      );

      // Create or update match
      await prisma.match.upsert({
        where: { externalId: matchData.id.toString() },
        create: {
          externalId: matchData.id.toString(),
          leagueId: league.id,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          startTime: matchDate,
          status: this.mapStatus(matchData.state.developer_name),
          homeOdds: odds?.home,
          drawOdds: odds?.draw,
          awayOdds: odds?.away,
          h2hHomeWins: h2h.homeWins,
          h2hDraws: h2h.draws,
          h2hAwayWins: h2h.awayWins,
        },
        update: {
          startTime: matchDate,
          status: this.mapStatus(matchData.state.developer_name),
          homeOdds: odds?.home,
          drawOdds: odds?.draw,
          awayOdds: odds?.away,
          h2hHomeWins: h2h.homeWins,
          h2hDraws: h2h.draws,
          h2hAwayWins: h2h.awayWins,
        },
      });

      logger.debug({ matchId: matchData.id }, "Match processed");
    } catch (error) {
      logger.error({ error, matchId: matchData.id }, "Failed to process match");
    }
  }

  /**
   * Update statistics for all teams
   */
  private async updateAllTeamStatistics(): Promise<void> {
    logger.info("Updating team statistics from Sportmonks...");
    const teams = await prisma.team.findMany();

    const seasonId = await sportmonksClient.getCurrentSeasonId();
    if (!seasonId) {
      logger.warn("Could not determine current season");
    }

    for (const team of teams) {
      try {
        await this.updateTeamStatistics(team.id);
      } catch (error) {
        logger.error(
          { teamId: team.id, error },
          "Failed to update team statistics",
        );
      }
    }
  }

  /**
   * Update team statistics from Sportmonks
   */
  async updateTeamStatistics(teamId: number): Promise<void> {
    try {
      const team = await prisma.team.findUnique({ where: { id: teamId } });
      if (!team) return;

      // Fetch recent form from Sportmonks
      const form = await sportmonksClient.getTeamForm(team.externalId, 10);
      if (!form) {
        logger.debug({ teamId }, "No form data available");
        return;
      }

      // Calculate form metrics
      const formPoints = form.form.slice(0, 5).reduce((acc, result) => {
        if (result === "W") return acc + 3;
        if (result === "D") return acc + 1;
        return acc;
      }, 0);

      const avgGoalsScored =
        form.goalsScored.length > 0
          ? form.goalsScored.reduce((a, b) => a + b, 0) /
            form.goalsScored.length
          : 0;
      const avgGoalsConceded =
        form.goalsConceded.length > 0
          ? form.goalsConceded.reduce((a, b) => a + b, 0) /
            form.goalsConceded.length
          : 0;

      // Calculate win rates
      const totalMatches = form.form.length;
      const wins = form.form.filter((r) => r === "W").length;
      const homeWinRate = totalMatches > 0 ? wins / totalMatches : 0;
      const awayWinRate = totalMatches > 0 ? wins / totalMatches : 0;

      // Update team
      await prisma.team.update({
        where: { id: teamId },
        data: {
          formPoints,
          avgGoalsScored: Math.round(avgGoalsScored * 100) / 100,
          avgGoalsConceded: Math.round(avgGoalsConceded * 100) / 100,
          homeWinRate,
          awayWinRate,
          played: totalMatches,
          wins,
          draws: form.form.filter((r) => r === "D").length,
          losses: form.form.filter((r) => r === "L").length,
        },
      });

      logger.debug({ teamId }, "Team statistics updated");
    } catch (error) {
      logger.error({ error, teamId }, "Failed to update team statistics");
    }
  }

  /**
   * Fetch and store team injuries from Sportmonks
   */
  async updateTeamInjuries(teamId: number): Promise<void> {
    try {
      const team = await prisma.team.findUnique({ where: { id: teamId } });
      if (!team) return;

      const injuries = await sportmonksClient.getTeamInjuries(team.externalId);

      // Clear existing injuries
      await prisma.injury.deleteMany({ where: { teamId } });

      // Store new injuries
      for (const injury of injuries) {
        await prisma.injury.create({
          data: {
            teamId,
            playerName: injury.player_name || "Unknown",
            position: injury.position || "Unknown",
            severity: this.mapInjurySeverity(injury.type),
            expectedReturn: injury.expected_return
              ? new Date(injury.expected_return)
              : null,
            description: injury.reason || null,
          },
        });
      }

      logger.debug({ teamId, count: injuries.length }, "Injuries updated");
    } catch (error) {
      logger.error({ error, teamId }, "Failed to update team injuries");
    }
  }

  /**
   * Ensure league exists in database
   */
  private async ensureLeague(leagueData: any): Promise<any> {
    return prisma.league.upsert({
      where: { externalId: leagueData.id.toString() },
      create: {
        externalId: leagueData.id.toString(),
        name: leagueData.name,
        country: leagueData.country?.name || "England",
        logo: leagueData.image_path || null,
        priority: leagueData.id === 8 ? 1 : 10, // Premier League priority
      },
      update: {
        name: leagueData.name,
        logo: leagueData.image_path || null,
      },
    });
  }

  /**
   * Ensure team exists in database
   */
  private async ensureTeam(teamData: any, leagueId: number): Promise<any> {
    return prisma.team.upsert({
      where: { externalId: teamData.id },
      create: {
        externalId: teamData.id,
        name: teamData.name,
        shortName: teamData.short_code || teamData.name,
        leagueId,
      },
      update: {
        name: teamData.name,
        shortName: teamData.short_code || teamData.name,
      },
    });
  }

  /**
   * Map Sportmonks status to internal status
   */
  private mapStatus(sportmonksStatus: string): MatchStatus {
    const statusMap: Record<string, MatchStatus> = {
      notstarted: "SCHEDULED",
      ns: "SCHEDULED",
      inplay: "LIVE",
      live: "LIVE",
      ht: "LIVE",
      finished: "FINISHED",
      ft: "FINISHED",
      postponed: "POSTPONED",
      cancelled: "POSTPONED",
      abandoned: "POSTPONED",
    };

    return statusMap[sportmonksStatus.toLowerCase()] || "SCHEDULED";
  }

  /**
   * Map injury type to severity
   */
  private mapInjurySeverity(injuryType: string): InjurySeverity {
    const lowerType = injuryType?.toLowerCase() || "";

    if (lowerType.includes("serious") || lowerType.includes("long")) {
      return "LONG_TERM";
    }
    if (lowerType.includes("severe") || lowerType.includes("major")) {
      return "SERIOUS";
    }
    if (lowerType.includes("moderate") || lowerType.includes("medium")) {
      return "MODERATE";
    }
    return "MINOR";
  }
}

export const dataIngestionService = new DataIngestionService();
