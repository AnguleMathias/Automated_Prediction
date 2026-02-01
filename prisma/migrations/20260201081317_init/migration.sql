-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InjurySeverity" AS ENUM ('MINOR', 'MODERATE', 'SEVERE', 'DOUBTFUL');

-- CreateEnum
CREATE TYPE "BetType" AS ENUM ('HOME_WIN', 'AWAY_WIN', 'DRAW', 'BTTS', 'OVER_2_5', 'UNDER_2_5');

-- CreateEnum
CREATE TYPE "BetCategory" AS ENUM ('SAFE_BET', 'VALUE_BET', 'RISKY_BET', 'AVOID');

-- CreateTable
CREATE TABLE "League" (
    "id" SERIAL NOT NULL,
    "externalId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "season" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" SERIAL NOT NULL,
    "externalId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "position" INTEGER,
    "played" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "goalsFor" INTEGER NOT NULL DEFAULT 0,
    "goalsAgainst" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "formPoints" INTEGER NOT NULL DEFAULT 0,
    "homeWinRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "awayWinRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgGoalsScored" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgGoalsConceded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" SERIAL NOT NULL,
    "externalId" INTEGER NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "homeTeamId" INTEGER NOT NULL,
    "awayTeamId" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "homeOdds" DOUBLE PRECISION,
    "drawOdds" DOUBLE PRECISION,
    "awayOdds" DOUBLE PRECISION,
    "h2hHomeWins" INTEGER NOT NULL DEFAULT 0,
    "h2hDraws" INTEGER NOT NULL DEFAULT 0,
    "h2hAwayWins" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Injury" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "playerName" TEXT NOT NULL,
    "position" TEXT,
    "severity" "InjurySeverity" NOT NULL,
    "expectedReturn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Injury_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prediction" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "recommendedTeamId" INTEGER NOT NULL,
    "betType" "BetType" NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "formScore" DOUBLE PRECISION NOT NULL,
    "homeAwayScore" DOUBLE PRECISION NOT NULL,
    "h2hScore" DOUBLE PRECISION NOT NULL,
    "injuryImpact" DOUBLE PRECISION NOT NULL,
    "leagueMotivation" DOUBLE PRECISION NOT NULL,
    "oddsValue" DOUBLE PRECISION NOT NULL,
    "category" "BetCategory" NOT NULL,
    "reasoning" TEXT NOT NULL,
    "keyFactors" TEXT[],
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeekendSnapshot" (
    "id" SERIAL NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "totalMatches" INTEGER NOT NULL,
    "totalPredictions" INTEGER NOT NULL,
    "avgConfidence" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeekendSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "League_externalId_key" ON "League"("externalId");

-- CreateIndex
CREATE INDEX "League_externalId_idx" ON "League"("externalId");

-- CreateIndex
CREATE INDEX "League_country_season_idx" ON "League"("country", "season");

-- CreateIndex
CREATE UNIQUE INDEX "Team_externalId_key" ON "Team"("externalId");

-- CreateIndex
CREATE INDEX "Team_externalId_idx" ON "Team"("externalId");

-- CreateIndex
CREATE INDEX "Team_leagueId_position_idx" ON "Team"("leagueId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Match_externalId_key" ON "Match"("externalId");

-- CreateIndex
CREATE INDEX "Match_externalId_idx" ON "Match"("externalId");

-- CreateIndex
CREATE INDEX "Match_startTime_idx" ON "Match"("startTime");

-- CreateIndex
CREATE INDEX "Match_leagueId_startTime_idx" ON "Match"("leagueId", "startTime");

-- CreateIndex
CREATE INDEX "Injury_teamId_severity_idx" ON "Injury"("teamId", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "Prediction_matchId_key" ON "Prediction"("matchId");

-- CreateIndex
CREATE INDEX "Prediction_matchId_idx" ON "Prediction"("matchId");

-- CreateIndex
CREATE INDEX "Prediction_category_confidenceScore_idx" ON "Prediction"("category", "confidenceScore");

-- CreateIndex
CREATE INDEX "Prediction_generatedAt_idx" ON "Prediction"("generatedAt");

-- CreateIndex
CREATE INDEX "WeekendSnapshot_weekStart_idx" ON "WeekendSnapshot"("weekStart");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Injury" ADD CONSTRAINT "Injury_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_recommendedTeamId_fkey" FOREIGN KEY ("recommendedTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
