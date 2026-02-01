import swaggerJsdoc from "swagger-jsdoc";
import { config } from "./index";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Football Betting Assistant API",
    version: "1.0.0",
    description: `
A comprehensive football betting assistant that provides data-driven predictions for weekend matches.
The system analyzes multiple factors including team form, home/away performance, head-to-head records,
injury reports, and market odds to generate confidence-scored betting recommendations.

**Key Features:**
- Multi-factor prediction algorithm
- Confidence scoring system
- Automated data ingestion
- Real-time odds integration
- Injury impact analysis
- Historical performance tracking

**Prediction Categories:**
- SAFE_BET: High confidence (85%+), low risk
- VALUE_BET: Good odds value with reasonable confidence (70-85%)
- RISKY_BET: Lower confidence (<70%), higher potential reward
- INFORMATIONAL: Analyzed but not recommended for betting

**Important:** This is a statistical analysis tool. Always bet responsibly and within your means.
    `.trim(),
    contact: {
      name: "API Support",
      email: "support@example.com",
    },
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT",
    },
  },
  servers: [
    {
      url: `http://localhost:${config.PORT}`,
      description: "Development server",
    },
    {
      url: "https://api.yourdomain.com",
      description: "Production server",
    },
  ],
  tags: [
    {
      name: "Health",
      description: "Health check endpoints",
    },
    {
      name: "Predictions",
      description: "Match prediction endpoints",
    },
    {
      name: "Matches",
      description: "Match data endpoints",
    },
    {
      name: "Data Management",
      description: "Data ingestion and refresh endpoints",
    },
    {
      name: "Statistics",
      description: "System statistics and analytics",
    },
  ],
  components: {
    schemas: {
      HealthCheck: {
        type: "object",
        properties: {
          status: {
            type: "string",
            example: "healthy",
            description: "Overall system health status",
          },
          timestamp: {
            type: "string",
            format: "date-time",
            example: "2024-01-20T10:30:00Z",
          },
          uptime: {
            type: "number",
            example: 3600,
            description: "Server uptime in seconds",
          },
          version: {
            type: "string",
            example: "1.0.0",
          },
        },
      },
      Prediction: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            example: "123e4567-e89b-12d3-a456-426614174000",
          },
          matchId: {
            type: "string",
            format: "uuid",
          },
          recommendedTeamId: {
            type: "string",
            format: "uuid",
          },
          recommendedTeam: {
            $ref: "#/components/schemas/Team",
          },
          betType: {
            type: "string",
            enum: [
              "HOME_WIN",
              "AWAY_WIN",
              "DRAW",
              "OVER_UNDER",
              "BOTH_TEAMS_SCORE",
            ],
            example: "HOME_WIN",
          },
          category: {
            type: "string",
            enum: ["SAFE_BET", "VALUE_BET", "RISKY_BET", "INFORMATIONAL"],
            example: "VALUE_BET",
          },
          confidence: {
            type: "number",
            format: "float",
            minimum: 0,
            maximum: 100,
            example: 78.5,
            description: "Confidence score (0-100%)",
          },
          reasoning: {
            type: "string",
            example:
              "Strong home form (80%) combined with favorable head-to-head record. Away team missing key players.",
          },
          factors: {
            type: "object",
            properties: {
              formScore: { type: "number", example: 80 },
              homeAwayScore: { type: "number", example: 75 },
              h2hScore: { type: "number", example: 65 },
              injuryImpact: { type: "number", example: 15 },
              leagueMotivation: { type: "number", example: 10 },
            },
          },
          odds: {
            type: "number",
            format: "float",
            example: 2.15,
            nullable: true,
          },
          impliedProbability: {
            type: "number",
            format: "float",
            example: 46.5,
            nullable: true,
          },
          valueScore: {
            type: "number",
            format: "float",
            example: 32.0,
            nullable: true,
            description: "Value bet score (positive indicates value)",
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
          match: {
            $ref: "#/components/schemas/Match",
          },
        },
      },
      Match: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
          },
          externalId: {
            type: "string",
            example: "ss_12345",
          },
          homeTeamId: {
            type: "string",
            format: "uuid",
          },
          awayTeamId: {
            type: "string",
            format: "uuid",
          },
          leagueId: {
            type: "string",
            format: "uuid",
          },
          homeTeam: {
            $ref: "#/components/schemas/Team",
          },
          awayTeam: {
            $ref: "#/components/schemas/Team",
          },
          league: {
            $ref: "#/components/schemas/League",
          },
          startTime: {
            type: "string",
            format: "date-time",
            example: "2024-01-27T15:00:00Z",
          },
          status: {
            type: "string",
            enum: ["SCHEDULED", "LIVE", "FINISHED", "POSTPONED"],
            example: "SCHEDULED",
          },
          homeScore: {
            type: "integer",
            nullable: true,
            example: null,
          },
          awayScore: {
            type: "integer",
            nullable: true,
            example: null,
          },
          venue: {
            type: "string",
            example: "Old Trafford",
            nullable: true,
          },
        },
      },
      Team: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
          },
          externalId: {
            type: "string",
            example: "ss_team_456",
          },
          name: {
            type: "string",
            example: "Manchester United",
          },
          shortName: {
            type: "string",
            example: "Man United",
          },
          logo: {
            type: "string",
            format: "uri",
            nullable: true,
          },
          currentForm: {
            type: "string",
            example: "WWDWL",
            description: "Last 5 matches (W=Win, D=Draw, L=Loss)",
          },
          homeForm: {
            type: "string",
            example: "WWWDW",
          },
          awayForm: {
            type: "string",
            example: "DWLLW",
          },
          leaguePosition: {
            type: "integer",
            example: 3,
            nullable: true,
          },
          points: {
            type: "integer",
            example: 45,
            nullable: true,
          },
          goalsScored: {
            type: "integer",
            example: 38,
            nullable: true,
          },
          goalsConceded: {
            type: "integer",
            example: 22,
            nullable: true,
          },
        },
      },
      League: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
          },
          externalId: {
            type: "string",
            example: "ss_league_17",
          },
          name: {
            type: "string",
            example: "Premier League",
          },
          country: {
            type: "string",
            example: "England",
          },
          logo: {
            type: "string",
            format: "uri",
            nullable: true,
          },
          priority: {
            type: "integer",
            example: 1,
            description: "League priority (1=highest)",
          },
        },
      },
      Injury: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
          },
          teamId: {
            type: "string",
            format: "uuid",
          },
          playerName: {
            type: "string",
            example: "Bruno Fernandes",
          },
          position: {
            type: "string",
            example: "Midfielder",
          },
          severity: {
            type: "string",
            enum: ["MINOR", "MODERATE", "SERIOUS", "LONG_TERM"],
            example: "MODERATE",
          },
          expectedReturn: {
            type: "string",
            format: "date",
            nullable: true,
            example: "2024-02-01",
          },
          description: {
            type: "string",
            example: "Hamstring injury",
            nullable: true,
          },
        },
      },
      RefreshResponse: {
        type: "object",
        properties: {
          status: {
            type: "string",
            example: "success",
          },
          message: {
            type: "string",
            example: "Data refresh initiated",
          },
          jobId: {
            type: "string",
            example: "refresh_1234567890",
          },
        },
      },
      Statistics: {
        type: "object",
        properties: {
          totalPredictions: {
            type: "integer",
            example: 45,
          },
          predictionsByCategory: {
            type: "object",
            properties: {
              SAFE_BET: { type: "integer", example: 12 },
              VALUE_BET: { type: "integer", example: 18 },
              RISKY_BET: { type: "integer", example: 10 },
              INFORMATIONAL: { type: "integer", example: 5 },
            },
          },
          averageConfidence: {
            type: "number",
            format: "float",
            example: 72.5,
          },
          totalMatches: {
            type: "integer",
            example: 50,
          },
          leagues: {
            type: "integer",
            example: 8,
          },
          teams: {
            type: "integer",
            example: 120,
          },
          lastUpdate: {
            type: "string",
            format: "date-time",
          },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: {
            type: "string",
            example: "Invalid request",
          },
          message: {
            type: "string",
            example: "The minConfidence parameter must be between 0 and 100",
          },
          statusCode: {
            type: "integer",
            example: 400,
          },
        },
      },
    },
    parameters: {
      MinConfidence: {
        name: "minConfidence",
        in: "query",
        description: "Minimum confidence score (0-100)",
        required: false,
        schema: {
          type: "number",
          minimum: 0,
          maximum: 100,
          example: 75,
        },
      },
      Category: {
        name: "category",
        in: "query",
        description: "Filter by prediction category",
        required: false,
        schema: {
          type: "string",
          enum: ["SAFE_BET", "VALUE_BET", "RISKY_BET", "INFORMATIONAL"],
        },
      },
      League: {
        name: "league",
        in: "query",
        description: "Filter by league name",
        required: false,
        schema: {
          type: "string",
          example: "Premier League",
        },
      },
      MatchId: {
        name: "matchId",
        in: "path",
        description: "Match UUID",
        required: true,
        schema: {
          type: "string",
          format: "uuid",
        },
      },
    },
    responses: {
      BadRequest: {
        description: "Bad request - Invalid parameters",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
          },
        },
      },
      NotFound: {
        description: "Resource not found",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
          },
        },
      },
      InternalError: {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
          },
        },
      },
    },
  },
};

const options: swaggerJsdoc.Options = {
  swaggerDefinition,
  apis: ["./src/routes/*.ts", "./src/index.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
