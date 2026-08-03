-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'TEACHER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('ZH_CN', 'EN_US');

-- CreateEnum
CREATE TYPE "SemesterStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ClassStatus" AS ENUM ('SETUP', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('LEADER', 'MARKETING_MANAGER', 'OPERATIONS_MANAGER', 'FINANCE_MANAGER', 'REVENUE_MANAGER', 'MEMBER');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DecisionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'LOCKED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "studentId" TEXT,
    "locale" "Locale" NOT NULL DEFAULT 'ZH_CN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "semesters" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "status" "SemesterStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semesters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "maxTeams" INTEGER NOT NULL DEFAULT 8,
    "maxTeamSize" INTEGER NOT NULL DEFAULT 6,
    "minTeamSize" INTEGER NOT NULL DEFAULT 3,
    "totalRooms" INTEGER NOT NULL DEFAULT 500,
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "maxRounds" INTEGER NOT NULL DEFAULT 12,
    "status" "ClassStatus" NOT NULL DEFAULT 'SETUP',
    "simParameters" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hotelName" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#DC2626',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_states" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "cashBalance" DOUBLE PRECISION NOT NULL DEFAULT 50000000,
    "totalDebt" DOUBLE PRECISION NOT NULL DEFAULT 200000000,
    "debtInterestRate" DOUBLE PRECISION NOT NULL DEFAULT 0.045,
    "accumulatedProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "propertyCondition" DOUBLE PRECISION NOT NULL DEFAULT 85,
    "furnitureCondition" DOUBLE PRECISION NOT NULL DEFAULT 90,
    "technologyLevel" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "brandReputation" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "onlineRating" DOUBLE PRECISION NOT NULL DEFAULT 4.0,
    "guestSatisfaction" DOUBLE PRECISION NOT NULL DEFAULT 75,
    "esgScore" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "energyEfficiency" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "staffMorale" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "staffTrainingLevel" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "lastUpdatedRound" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "hotel_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rounds" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "status" "RoundStatus" NOT NULL DEFAULT 'PENDING',
    "seasonFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "economyFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "eventFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "eventDescription" TEXT,
    "deadline" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decisions" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "status" "DecisionStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "submittedBy" TEXT,
    "priceBusinessTransient" DOUBLE PRECISION NOT NULL DEFAULT 580,
    "priceBusinessGroup" DOUBLE PRECISION NOT NULL DEFAULT 520,
    "priceLeisureTransient" DOUBLE PRECISION NOT NULL DEFAULT 480,
    "priceLeisureGroup" DOUBLE PRECISION NOT NULL DEFAULT 420,
    "priceGovernment" DOUBLE PRECISION NOT NULL DEFAULT 400,
    "priceOnlineOTA" DOUBLE PRECISION NOT NULL DEFAULT 450,
    "priceAirlineCrew" DOUBLE PRECISION NOT NULL DEFAULT 320,
    "priceLongStay" DOUBLE PRECISION NOT NULL DEFAULT 350,
    "marketingTotal" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "mktBudgetBusinessTransient" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "mktBudgetBusinessGroup" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "mktBudgetLeisureTransient" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "mktBudgetLeisureGroup" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "mktBudgetGovernment" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "mktBudgetOnlineOTA" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "mktBudgetAirlineCrew" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "mktBudgetLongStay" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "channelDirect" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "channelOTA" DOUBLE PRECISION NOT NULL DEFAULT 35,
    "channelTravelAgent" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "channelCorporate" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "channelGDS" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "opexRoomsMaintenance" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "opexFoodBeverage" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "opexFrontDesk" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "opexHousekeeping" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "opexUtilities" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "opexStaffTraining" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "opexStaffWelfare" DOUBLE PRECISION NOT NULL DEFAULT 6,
    "opexSecurity" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "opexIT" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "capexRenovation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "capexFurniture" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "capexTechnology" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "capexFacilities" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "capexESGGreen" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "newLoanAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "loanRepayment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "esgEnergyInvestment" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "esgWasteManagement" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "esgCommunityEngagement" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "esgEmployeeDiversity" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "taxStrategy" TEXT NOT NULL DEFAULT 'STANDARD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "round_results" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "occupancyRate" DOUBLE PRECISION NOT NULL,
    "adr" DOUBLE PRECISION NOT NULL,
    "revpar" DOUBLE PRECISION NOT NULL,
    "totalRoomsSold" INTEGER NOT NULL,
    "totalRoomsAvailable" INTEGER NOT NULL,
    "segmentResults" JSONB NOT NULL,
    "roomRevenue" DOUBLE PRECISION NOT NULL,
    "fbRevenue" DOUBLE PRECISION NOT NULL,
    "otherRevenue" DOUBLE PRECISION NOT NULL,
    "totalRevenue" DOUBLE PRECISION NOT NULL,
    "totalOpex" DOUBLE PRECISION NOT NULL,
    "totalMarketing" DOUBLE PRECISION NOT NULL,
    "totalCapex" DOUBLE PRECISION NOT NULL,
    "depreciationExpense" DOUBLE PRECISION NOT NULL,
    "interestExpense" DOUBLE PRECISION NOT NULL,
    "taxExpense" DOUBLE PRECISION NOT NULL,
    "grossOperatingProfit" DOUBLE PRECISION NOT NULL,
    "ebitda" DOUBLE PRECISION NOT NULL,
    "netProfit" DOUBLE PRECISION NOT NULL,
    "profitMargin" DOUBLE PRECISION NOT NULL,
    "overallMarketShare" DOUBLE PRECISION NOT NULL,
    "brandReputationEnd" DOUBLE PRECISION NOT NULL,
    "onlineRatingEnd" DOUBLE PRECISION NOT NULL,
    "guestSatisfactionEnd" DOUBLE PRECISION NOT NULL,
    "esgScoreEnd" DOUBLE PRECISION NOT NULL,
    "cashBalanceEnd" DOUBLE PRECISION NOT NULL,
    "totalDebtEnd" DOUBLE PRECISION NOT NULL,
    "debtToEquityRatio" DOUBLE PRECISION NOT NULL,
    "returnOnEquity" DOUBLE PRECISION NOT NULL,
    "rankRevenue" INTEGER NOT NULL,
    "rankProfit" INTEGER NOT NULL,
    "rankOccupancy" INTEGER NOT NULL,
    "rankOverall" INTEGER NOT NULL,
    "teacherScore" DOUBLE PRECISION,
    "teacherComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "round_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_studentId_key" ON "users"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "semesters_code_key" ON "semesters"("code");

-- CreateIndex
CREATE UNIQUE INDEX "classes_joinCode_key" ON "classes"("joinCode");

-- CreateIndex
CREATE UNIQUE INDEX "teams_classId_name_key" ON "teams"("classId", "name");

-- CreateIndex
CREATE INDEX "team_members_classId_idx" ON "team_members"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_teamId_userId_key" ON "team_members"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_classId_userId_key" ON "team_members"("classId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_states_teamId_key" ON "hotel_states"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "rounds_classId_roundNumber_key" ON "rounds"("classId", "roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "decisions_teamId_roundId_key" ON "decisions"("teamId", "roundId");

-- CreateIndex
CREATE INDEX "round_results_roundId_rankOverall_idx" ON "round_results"("roundId", "rankOverall");

-- CreateIndex
CREATE UNIQUE INDEX "round_results_teamId_roundId_key" ON "round_results"("teamId", "roundId");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_key_key" ON "system_configs"("key");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semesters" ADD CONSTRAINT "semesters_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_states" ADD CONSTRAINT "hotel_states_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_results" ADD CONSTRAINT "round_results_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_results" ADD CONSTRAINT "round_results_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

