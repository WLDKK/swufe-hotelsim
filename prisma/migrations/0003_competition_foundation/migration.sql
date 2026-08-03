ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'JUDGE';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SPECTATOR';

CREATE TYPE "RulesetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "CompetitionStatus" AS ENUM ('DRAFT', 'READY', 'ACTIVE', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "CompetitionStageStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "AdvancementStatus" AS ENUM ('QUALIFIED', 'ADVANCED', 'ELIMINATED', 'WAITLISTED');

ALTER TABLE "rounds"
ADD COLUMN "rulesetId" TEXT,
ADD COLUMN "rulesetVersion" TEXT,
ADD COLUMN "rulesetName" TEXT,
ADD COLUMN "parameterSnapshot" JSONB,
ADD COLUMN "scoringSnapshot" JSONB,
ADD COLUMN "randomSeed" TEXT,
ADD COLUMN "competitionStageId" TEXT;

ALTER TABLE "round_results"
ADD COLUMN "systemScore" DOUBLE PRECISION,
ADD COLUMN "systemScoreBreakdown" JSONB,
ADD COLUMN "penaltyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "explanationLog" JSONB,
ADD COLUMN "judgeScoreAverage" DOUBLE PRECISION,
ADD COLUMN "judgeScoreCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "finalScore" DOUBLE PRECISION;

CREATE TABLE "rulesets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "RulesetStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "formulaConfig" JSONB NOT NULL DEFAULT '{}',
    "scoringConfig" JSONB NOT NULL DEFAULT '{}',
    "rankingConfig" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "rulesets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "judge_scores" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "comment" TEXT,
    "breakdown" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "judge_scores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "competitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "status" "CompetitionStatus" NOT NULL DEFAULT 'DRAFT',
    "legacySemesterId" TEXT,
    "rulesetId" TEXT,
    "createdById" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "competition_stages" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stageOrder" INTEGER NOT NULL,
    "status" "CompetitionStageStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "maxRounds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "competition_stages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "advancements" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "stageId" TEXT,
    "teamId" TEXT NOT NULL,
    "sourceRoundId" TEXT,
    "targetClassId" TEXT,
    "status" "AdvancementStatus" NOT NULL DEFAULT 'QUALIFIED',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "advancements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rulesets_name_version_key" ON "rulesets"("name", "version");
CREATE INDEX "rulesets_status_idx" ON "rulesets"("status");

CREATE UNIQUE INDEX "judge_scores_resultId_judgeId_key" ON "judge_scores"("resultId", "judgeId");
CREATE INDEX "judge_scores_judgeId_createdAt_idx" ON "judge_scores"("judgeId", "createdAt");

CREATE UNIQUE INDEX "competitions_code_key" ON "competitions"("code");
CREATE INDEX "competitions_status_idx" ON "competitions"("status");
CREATE INDEX "competitions_legacySemesterId_idx" ON "competitions"("legacySemesterId");
CREATE INDEX "competitions_rulesetId_idx" ON "competitions"("rulesetId");

CREATE UNIQUE INDEX "competition_stages_competitionId_stageOrder_key" ON "competition_stages"("competitionId", "stageOrder");
CREATE INDEX "competition_stages_competitionId_status_idx" ON "competition_stages"("competitionId", "status");

CREATE INDEX "advancements_competitionId_teamId_idx" ON "advancements"("competitionId", "teamId");
CREATE INDEX "advancements_stageId_idx" ON "advancements"("stageId");
CREATE INDEX "advancements_sourceRoundId_idx" ON "advancements"("sourceRoundId");
CREATE INDEX "advancements_targetClassId_idx" ON "advancements"("targetClassId");

CREATE INDEX "announcements_competitionId_isPublished_idx" ON "announcements"("competitionId", "isPublished");
CREATE INDEX "announcements_publishedAt_idx" ON "announcements"("publishedAt");

CREATE INDEX "rounds_rulesetId_idx" ON "rounds"("rulesetId");
CREATE INDEX "rounds_competitionStageId_idx" ON "rounds"("competitionStageId");
CREATE INDEX "round_results_finalScore_idx" ON "round_results"("finalScore");

ALTER TABLE "rounds"
ADD CONSTRAINT "rounds_rulesetId_fkey"
FOREIGN KEY ("rulesetId") REFERENCES "rulesets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "rounds"
ADD CONSTRAINT "rounds_competitionStageId_fkey"
FOREIGN KEY ("competitionStageId") REFERENCES "competition_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "judge_scores"
ADD CONSTRAINT "judge_scores_resultId_fkey"
FOREIGN KEY ("resultId") REFERENCES "round_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "judge_scores"
ADD CONSTRAINT "judge_scores_judgeId_fkey"
FOREIGN KEY ("judgeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "competitions"
ADD CONSTRAINT "competitions_legacySemesterId_fkey"
FOREIGN KEY ("legacySemesterId") REFERENCES "semesters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "competitions"
ADD CONSTRAINT "competitions_rulesetId_fkey"
FOREIGN KEY ("rulesetId") REFERENCES "rulesets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "competitions"
ADD CONSTRAINT "competitions_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "competition_stages"
ADD CONSTRAINT "competition_stages_competitionId_fkey"
FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "advancements"
ADD CONSTRAINT "advancements_competitionId_fkey"
FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "advancements"
ADD CONSTRAINT "advancements_stageId_fkey"
FOREIGN KEY ("stageId") REFERENCES "competition_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "advancements"
ADD CONSTRAINT "advancements_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "advancements"
ADD CONSTRAINT "advancements_sourceRoundId_fkey"
FOREIGN KEY ("sourceRoundId") REFERENCES "rounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "advancements"
ADD CONSTRAINT "advancements_targetClassId_fkey"
FOREIGN KEY ("targetClassId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "announcements"
ADD CONSTRAINT "announcements_competitionId_fkey"
FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "announcements"
ADD CONSTRAINT "announcements_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
