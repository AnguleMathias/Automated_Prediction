import axios, { AxiosInstance, AxiosError } from "axios";
import { config } from "../config";
import { logger } from "../utils/logger";
import { cache } from "../utils/cache";

interface SportmonksFixture {
  id: number;
  name: string;
  starting_at: string;
  result_info: string | null;
  leg: string;
  details: string | null;
  length: number;
  placeholder: boolean;
  has_odds: boolean;
  starting_at_timestamp: number;
  participants: Array<{
    id: number;
    sport_id: number;
    country_id: number;
    venue_id: number;
    gender: string;
    name: string;
    short_code: string;
    image_path: string;
    founded: number;
    type: string;
    placeholder: boolean;
    last_played_at: string;
    meta: {
      location: string;
      winner: boolean;
      position: string;
    };
  }>;
  state: {
    id: number;
    state: string;
    name: string;
    short_name: string;
    developer_name: string;
  };
  league: {
    id: number;
    sport_id: number;
    country_id: number;
    name: string;
    active: boolean;
    short_code: string;
    image_path: string;
    type: string;
    sub_type: string;
    last_played_at: string;
  };
}

interface SportmonksStanding {
  id: number;
  participant_id: number;
  sport_id: number;
  league_id: number;
  season_id: number;
  stage_id: number;
  group_id: number | null;
  round_id: number | null;
  standing_rule_id: number;
  position: number;
  result: string | null;
  points: number;
  participant: {
    id: number;
    name: string;
    short_code: string;
    image_path: string;
  };
  details: Array<{
    id: number;
    type_id: number;
    standing_type: string;
    standing_id: number;
    value: number;
    type: {
      id: number;
      name: string;
      code: string;
      developer_name: string;
      model_type: string;
      stat_group: string;
    };
  }>;
}

interface TeamForm {
  teamId: number;
  form: string[]; // ['W', 'L', 'D', 'W', 'W']
  goalsScored: number[];
  goalsConceded: number[];
}

export class SportmonksClient {
  private client: AxiosInstance;
  private lastRequestTime: number = 0;

  constructor() {
    this.client = axios.create({
      baseURL: config.SPORTMONKS_API_BASE,
      timeout: 15000,
      headers: {
        Accept: "application/json",
        Authorization: config.SPORTMONKS_API_KEY || "",
      },
    });
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < config.SPORTMONKS_RATE_LIMIT_DELAY) {
      const waitTime =
        config.SPORTMONKS_RATE_LIMIT_DELAY - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  private async request<T>(
    endpoint: string,
    params: Record<string, any> = {},
    cacheKey?: string,
    cacheTTL: number = 3600,
  ): Promise<T> {
    // Check API key
    if (!config.SPORTMONKS_API_KEY) {
      logger.warn("Sportmonks API key not configured");
      throw new Error("Sportmonks API key is required");
    }

    // Check cache first
    if (cacheKey) {
      const cached = await cache.get<T>(cacheKey);
      if (cached) {
        logger.debug({ cacheKey }, "Cache hit");
        return cached;
      }
    }

    await this.rateLimit();

    try {
      const response = await this.client.get<T>(endpoint, { params });

      // Cache the response
      if (cacheKey && response.data) {
        await cache.set(cacheKey, response.data, cacheTTL);
      }

      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        logger.error(
          {
            endpoint,
            status: error.response?.status,
            message: error.message,
            data: error.response?.data,
          },
          "Sportmonks API error",
        );

        if (error.response?.status === 429) {
          throw new Error("Rate limit exceeded");
        }
        if (error.response?.status === 401) {
          throw new Error("Invalid API key");
        }
      }
      throw error;
    }
  }

  /**
   * Fetch fixtures for today's Premier League matches
   */
  async getTodaysPremierLeagueMatches(): Promise<SportmonksFixture[]> {
    const today = new Date().toISOString().split("T")[0];
    const cacheKey = `sportmonks:fixtures:premier-league:${today}`;

    try {
      logger.info(
        { date: today },
        "Fetching today's Premier League fixtures from Sportmonks",
      );

      // Sportmonks API endpoint for fixtures
      // Include league filter for Premier League (league_id: 8)
      const response = await this.request<{ data: SportmonksFixture[] }>(
        "/football/fixtures",
        {
          filters: `fixtureLeagues:8`, // Premier League ID
          date: today,
          include: "participants;league;state",
        },
        cacheKey,
        1800, // 30 minutes cache
      );

      const fixtures = response.data || [];
      logger.info(
        { count: fixtures.length },
        "Fetched Premier League fixtures",
      );

      return fixtures;
    } catch (error) {
      logger.error(
        { error, date: today },
        "Failed to fetch Premier League fixtures from Sportmonks",
      );
      throw error;
    }
  }

  /**
   * Get Premier League standings
   */
  async getPremierLeagueStandings(
    seasonId: number,
  ): Promise<SportmonksStanding[]> {
    const cacheKey = `sportmonks:standings:premier-league:${seasonId}`;

    try {
      const response = await this.request<{ data: SportmonksStanding[] }>(
        `/football/standings/seasons/${seasonId}`,
        {
          filters: "standingLeagues:8", // Premier League
          include: "participant;details.type",
        },
        cacheKey,
        3600, // 1 hour cache
      );

      return response.data || [];
    } catch (error) {
      logger.error(
        { error, seasonId },
        "Failed to fetch Premier League standings",
      );
      return [];
    }
  }

  /**
   * Get team details
   */
  async getTeamDetails(teamId: number): Promise<any> {
    const cacheKey = `sportmonks:team:${teamId}`;

    try {
      const response = await this.request<{ data: any }>(
        `/football/teams/${teamId}`,
        {
          include: "venue;country",
        },
        cacheKey,
        7200, // 2 hours cache
      );

      return response.data;
    } catch (error) {
      logger.error({ error, teamId }, "Failed to fetch team details");
      return null;
    }
  }

  /**
   * Get team's last N fixtures for form calculation
   */
  async getTeamForm(
    teamId: number,
    limit: number = 10,
  ): Promise<TeamForm | null> {
    const cacheKey = `sportmonks:form:${teamId}:${limit}`;

    try {
      const response = await this.request<{ data: SportmonksFixture[] }>(
        `/football/fixtures`,
        {
          filters: `fixtureParticipants:${teamId}`,
          include: "participants;scores;state",
          per_page: limit,
          order: "starting_at:desc",
        },
        cacheKey,
        1800, // 30 minutes cache
      );

      const fixtures = response.data || [];

      const form: string[] = [];
      const goalsScored: number[] = [];
      const goalsConceded: number[] = [];

      fixtures.forEach((fixture) => {
        if (fixture.state.developer_name === "finished") {
          const team = fixture.participants.find((p) => p.id === teamId);
          const opponent = fixture.participants.find((p) => p.id !== teamId);

          if (team && opponent) {
            const isWinner = team.meta.winner;

            // Determine result
            if (isWinner) {
              form.push("W");
            } else if (opponent.meta.winner) {
              form.push("L");
            } else {
              form.push("D");
            }

            // Parse scores from fixture name or result_info
            // Note: Actual score parsing depends on Sportmonks response format
            goalsScored.push(0); // Placeholder - parse from actual data
            goalsConceded.push(0); // Placeholder - parse from actual data
          }
        }
      });

      return {
        teamId,
        form,
        goalsScored,
        goalsConceded,
      };
    } catch (error) {
      logger.error({ error, teamId, limit }, "Failed to fetch team form");
      return null;
    }
  }

  /**
   * Get head-to-head statistics between two teams
   */
  async getHeadToHead(
    homeTeamId: number,
    awayTeamId: number,
  ): Promise<{
    homeWins: number;
    draws: number;
    awayWins: number;
  }> {
    const cacheKey = `sportmonks:h2h:${homeTeamId}:${awayTeamId}`;

    try {
      const response = await this.request<{ data: SportmonksFixture[] }>(
        `/football/fixtures/head-to-head/${homeTeamId}/${awayTeamId}`,
        {
          include: "participants;state",
        },
        cacheKey,
        7200, // 2 hours cache
      );

      const fixtures = response.data || [];
      let homeWins = 0;
      let draws = 0;
      let awayWins = 0;

      fixtures.forEach((fixture) => {
        if (fixture.state.developer_name === "finished") {
          const homeTeam = fixture.participants.find(
            (p) => p.id === homeTeamId,
          );
          const awayTeam = fixture.participants.find(
            (p) => p.id === awayTeamId,
          );

          if (homeTeam?.meta.winner) {
            homeWins++;
          } else if (awayTeam?.meta.winner) {
            awayWins++;
          } else {
            draws++;
          }
        }
      });

      return { homeWins, draws, awayWins };
    } catch (error) {
      logger.error(
        { error, homeTeamId, awayTeamId },
        "Failed to fetch head-to-head",
      );
      return { homeWins: 0, draws: 0, awayWins: 0 };
    }
  }

  /**
   * Get team injuries
   */
  async getTeamInjuries(teamId: number): Promise<any[]> {
    // Sportmonks may not have injury data in all plans
    // This is a placeholder
    logger.debug({ teamId }, "Injury data may require premium Sportmonks plan");
    return [];
  }

  /**
   * Get current Premier League season ID
   */
  async getCurrentSeasonId(): Promise<number | null> {
    const cacheKey = "sportmonks:season:premier-league:current";

    try {
      const response = await this.request<{ data: any[] }>(
        "/football/seasons",
        {
          filters: "seasonLeagues:8", // Premier League
          include: "league",
        },
        cacheKey,
        86400, // 24 hours cache
      );

      // Find the current active season
      const currentSeason = response.data?.find(
        (season) => season.is_current === true,
      );

      return currentSeason?.id || null;
    } catch (error) {
      logger.error({ error }, "Failed to fetch current season");
      return null;
    }
  }
}

export const sportmonksClient = new SportmonksClient();
