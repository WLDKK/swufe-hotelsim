import "dotenv/config";
import {
  ClassStatus,
  CompetitionStageStatus,
  CompetitionStatus,
  Locale,
  PrismaClient,
  RoundStatus,
  RulesetStatus,
  SemesterStatus,
  TeamRole,
  UserRole,
} from "@prisma/client";
import { hashPassword } from "../src/lib/auth/passwords";
import { DEFAULT_SIM_PARAMETERS, MARKET_SEGMENTS } from "../src/lib/constants";
import { PUBLIC_DEMO_PASSWORD } from "../src/lib/demo-accounts";
import { buildSimulationExplanationLog } from "../src/lib/simulation/explanations";
import { calculateFinalScore, calculateSystemScoreBreakdown } from "../src/lib/simulation/scoring";
import {
  buildDefaultRulesetConfig,
  buildRoundRuntimeSnapshot,
} from "../src/lib/simulation/rulesets";

const prisma = new PrismaClient();

// ============================================================
// Seed scenario knobs
// ============================================================
// These top-level knobs are the safest place to edit when product requirements
// change, because later logic derives counts and round state from them.

// Keep the seed profile explicit so later handoff work can tune dataset size
// without digging through the generation logic.
const seedProfile = {
  activeClassTeamCount: 2,
  studentsPerTeam: 3,
  reserveStudentCount: 2,
  maxRounds: 12,
  completedRounds: 0,
  initializeFirstRound: true,
  createDraftSemester: false,
  createCompetitionShell: true,
} as const;

// ============================================================
// Name/color/content pools
// ============================================================
// These pools intentionally contain more values than the current seed uses so
// future reruns can vary demo output without rewriting the generator.

const teamNamePool = [
  "Phoenix",
  "Harbor",
  "Aurora",
  "Summit",
  "Atlas",
  "Meridian",
  "Evergreen",
  "Crescent",
  "Lotus",
  "Pinnacle",
] as const;

const hotelDescriptorPool = [
  "Grand Hotel",
  "Business Hotel",
  "Riverside Hotel",
  "Harbor Hotel",
  "Crown Hotel",
  "Executive Suites",
  "Garden Hotel",
  "Convention Hotel",
] as const;

const teamColorPool = [
  "#8B1A1A",
  "#1B3A5C",
  "#A82828",
  "#C9A84C",
  "#2F5D50",
  "#375A7F",
  "#9C6644",
  "#6B7280",
] as const;

const studentNamePool = [
  "Lin Wei",
  "Chen Yu",
  "Wang Rui",
  "Zhao Min",
  "Li Jing",
  "Sun Hao",
  "Liu Yan",
  "Xu Chen",
  "Deng Qi",
  "Guo Lin",
  "Feng Yue",
  "Peng Rui",
  "Jiang Tao",
  "He Xin",
  "Wu Tong",
  "Tang Yi",
  "Song Jie",
  "Xie Ran",
  "Cao Ning",
  "Zhou Kai",
  "Luo Qing",
  "Yuan Zhi",
  "Hu Ran",
  "Qin Yue",
] as const;

const roundDeadlineDates = [
  "2026-03-15T12:00:00.000Z",
  "2026-04-15T12:00:00.000Z",
  "2026-05-15T12:00:00.000Z",
  "2026-06-15T12:00:00.000Z",
  "2026-07-15T12:00:00.000Z",
  "2026-08-15T12:00:00.000Z",
  "2026-09-15T12:00:00.000Z",
  "2026-10-15T12:00:00.000Z",
  "2026-11-15T12:00:00.000Z",
  "2026-12-15T12:00:00.000Z",
  "2027-01-15T12:00:00.000Z",
  "2027-02-15T12:00:00.000Z",
] as const;

const roundSeasonFactors = [0.82, 0.78, 0.9, 1.0, 1.08, 1.0, 0.92, 0.9, 0.98, 1.08, 1.04, 0.88] as const;

const roundEventPool = [
  "Regional trade fair increases weekday corporate demand.",
  "City food festival boosts weekend leisure traffic.",
  "A competing hotel renovation redirects some OTA bookings.",
  "University conference season supports group business.",
  "Airline schedule expansion improves crew demand.",
  "Weather disruptions reduce short-leisure bookings for the month.",
] as const;

// ============================================================
// Seeded randomness helpers
// ============================================================
// `SEED_RANDOM_SEED` lets us regenerate the exact same demo dataset later.
// If the env var changes, the data changes, but the value ranges stay stable.
function createSeededRandom(seedInput = process.env.SEED_RANDOM_SEED ?? `${Date.now()}`) {
  let seed = 2166136261;

  for (const character of seedInput) {
    seed ^= character.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }

  return {
    seedInput,
    next() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x100000000;
    },
  };
}

const rng = createSeededRandom();

function roundTo(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

function randomFloat(min: number, max: number, decimals = 2) {
  return roundTo(min + rng.next() * (max - min), decimals);
}

function randomInt(min: number, max: number) {
  return Math.floor(rng.next() * (max - min + 1)) + min;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function shuffle<T>(items: readonly T[]) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function allocateTotal(total: number, weights: number[], decimals = 1) {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  let remaining = total;

  return weights.map((weight, index) => {
    if (index === weights.length - 1) {
      return roundTo(remaining, decimals);
    }

    const value = roundTo((total * weight) / weightSum, decimals);
    remaining = roundTo(remaining - value, decimals);
    return value;
  });
}

function allocateIntegers(total: number, weights: number[]) {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  let assigned = 0;

  return weights.map((weight, index) => {
    if (index === weights.length - 1) {
      return total - assigned;
    }

    const value = Math.round((total * weight) / weightSum);
    assigned += value;
    return value;
  });
}

function buildJoinCode(suffix: string) {
  return `HOTEL-26-${suffix}-${randomInt(100, 999)}`;
}

// The seed fully clears demo data first. This guard is intentionally strict so
// no one can accidentally point it at a shared Supabase database and wipe data.
function assertSeedResetAllowed() {
  if (process.env.ALLOW_DB_RESET !== "true") {
    throw new Error(
      [
        "Seed aborted because it performs a full demo-data reset.",
        "Set ALLOW_DB_RESET=true only when pointing at a disposable development database.",
      ].join(" ")
    );
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed aborted because demo reset is blocked when NODE_ENV=production.");
  }
}

async function resetDatabase() {
  assertSeedResetAllowed();

  // Dependency order matters here. Keeping deletes explicit makes it obvious
  // which business tables exist and what depends on what.
  await prisma.judgeScore.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.systemConfig.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.advancement.deleteMany();
  await prisma.roundResult.deleteMany();
  await prisma.decision.deleteMany();
  await prisma.round.deleteMany();
  await prisma.competitionStage.deleteMany();
  await prisma.competition.deleteMany();
  await prisma.hotelState.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();
  await prisma.class.deleteMany();
  await prisma.semester.deleteMany();
  await prisma.ruleset.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();
}

// ============================================================
// Business value builders
// ============================================================
// These functions define "reasonable random ranges" for hotel operations data.
// If course requirements change, edit the ranges here instead of the main flow.

function buildHotelState(): {
  cashBalance: number;
  totalDebt: number;
  debtInterestRate: number;
  accumulatedProfit: number;
  propertyCondition: number;
  furnitureCondition: number;
  technologyLevel: number;
  brandReputation: number;
  onlineRating: number;
  guestSatisfaction: number;
  esgScore: number;
  energyEfficiency: number;
  staffMorale: number;
  staffTrainingLevel: number;
  lastUpdatedRound: number;
} {
  return {
    cashBalance: randomInt(42_000_000, 58_000_000),
    totalDebt: randomInt(180_000_000, 225_000_000),
    debtInterestRate: randomFloat(0.041, 0.052, 4),
    accumulatedProfit: randomInt(-2_000_000, 5_000_000),
    propertyCondition: randomInt(78, 92),
    furnitureCondition: randomInt(80, 94),
    technologyLevel: randomInt(62, 84),
    brandReputation: randomInt(45, 66),
    onlineRating: randomFloat(3.8, 4.4, 2),
    guestSatisfaction: randomInt(68, 86),
    esgScore: randomInt(44, 68),
    energyEfficiency: randomInt(50, 76),
    staffMorale: randomInt(60, 83),
    staffTrainingLevel: randomInt(55, 80),
    lastUpdatedRound: seedProfile.completedRounds,
  };
}

function buildDecisionSnapshot() {
  const marketingTotal = randomInt(72, 118);
  const marketingBudgets = allocateTotal(
    marketingTotal,
    Array.from({ length: 8 }, () => randomFloat(0.8, 1.4, 3))
  );
  const channelMix = allocateTotal(
    100,
    [
      randomFloat(1.2, 2.1, 3),
      randomFloat(0.9, 1.8, 3),
      randomFloat(0.5, 1.1, 3),
      randomFloat(0.6, 1.4, 3),
      randomFloat(0.2, 0.6, 3),
    ]
  );

  return {
    priceBusinessTransient: randomInt(520, 690),
    priceBusinessGroup: randomInt(460, 620),
    priceLeisureTransient: randomInt(420, 620),
    priceLeisureGroup: randomInt(320, 520),
    priceGovernment: randomInt(320, 460),
    priceOnlineOTA: randomInt(360, 560),
    priceAirlineCrew: randomInt(240, 380),
    priceLongStay: randomInt(260, 420),
    marketingTotal,
    mktBudgetBusinessTransient: marketingBudgets[0],
    mktBudgetBusinessGroup: marketingBudgets[1],
    mktBudgetLeisureTransient: marketingBudgets[2],
    mktBudgetLeisureGroup: marketingBudgets[3],
    mktBudgetGovernment: marketingBudgets[4],
    mktBudgetOnlineOTA: marketingBudgets[5],
    mktBudgetAirlineCrew: marketingBudgets[6],
    mktBudgetLongStay: marketingBudgets[7],
    channelDirect: channelMix[0],
    channelOTA: channelMix[1],
    channelTravelAgent: channelMix[2],
    channelCorporate: channelMix[3],
    channelGDS: channelMix[4],
    opexRoomsMaintenance: randomInt(24, 42),
    opexFoodBeverage: randomInt(20, 34),
    opexFrontDesk: randomInt(12, 21),
    opexHousekeeping: randomInt(18, 32),
    opexUtilities: randomInt(16, 26),
    opexStaffTraining: randomInt(6, 14),
    opexStaffWelfare: randomInt(5, 12),
    opexSecurity: randomInt(4, 10),
    opexIT: randomInt(6, 13),
    capexRenovation: randomInt(0, 22),
    capexFurniture: randomInt(0, 15),
    capexTechnology: randomInt(0, 12),
    capexFacilities: randomInt(0, 10),
    capexESGGreen: randomInt(0, 12),
    newLoanAmount: randomInt(0, 28),
    loanRepayment: randomInt(0, 16),
    esgEnergyInvestment: randomInt(25, 68),
    esgWasteManagement: randomInt(25, 64),
    esgCommunityEngagement: randomInt(15, 48),
    esgEmployeeDiversity: randomInt(15, 46),
    taxStrategy: ["STANDARD", "INCENTIVE_FOCUS", "COMPLIANCE_FIRST"][randomInt(0, 2)],
  };
}

// Reporting still stores per-segment detail as JSON. This helper centralizes
// that shape so the Stage 3 engine/report pages can keep reusing one contract.
function buildSegmentResults(
  prices: {
    priceBusinessTransient: number;
    priceBusinessGroup: number;
    priceLeisureTransient: number;
    priceLeisureGroup: number;
    priceGovernment: number;
    priceOnlineOTA: number;
    priceAirlineCrew: number;
    priceLongStay: number;
  },
  totalRoomsSold: number
) {
  const soldRoomWeights = MARKET_SEGMENTS.map((segment) =>
    segment.baselineDemandShare * randomFloat(0.8, 1.25, 4)
  );
  const soldRoomDistribution = allocateIntegers(totalRoomsSold, soldRoomWeights);

  const priceMap = {
    business_transient: prices.priceBusinessTransient,
    business_group: prices.priceBusinessGroup,
    leisure_transient: prices.priceLeisureTransient,
    leisure_group: prices.priceLeisureGroup,
    government: prices.priceGovernment,
    online_ota: prices.priceOnlineOTA,
    airline_crew: prices.priceAirlineCrew,
    long_stay: prices.priceLongStay,
  } as const;

  return MARKET_SEGMENTS.map((segment, index) => {
    const roomsSold = soldRoomDistribution[index];
    const avgPrice = priceMap[segment.id];
    const captureRate = randomFloat(0.58, 0.9, 4);
    const demandAvailable = Math.max(roomsSold, Math.round(roomsSold / captureRate));

    return {
      segmentId: segment.id,
      segmentName: segment.nameEn,
      demandAvailable,
      demandCaptured: roomsSold,
      roomsSold,
      revenue: roundTo(roomsSold * avgPrice, 2),
      marketShare: roundTo(roomsSold / Math.max(totalRoomsSold, 1), 4),
      avgPrice,
    };
  });
}

function buildRoundResult(
  decision: ReturnType<typeof buildDecisionSnapshot>,
  hotelState: ReturnType<typeof buildHotelState>,
  roundNumber: number
) {
  // These formulas intentionally stay lightweight because the seed only needs
  // believable demo results. The live Stage 3 engine owns real processing,
  // but the stored result shape stays aligned so seeded data and live runs can
  // feed the same dashboards, rankings, grading, and export views.
  const totalRoomsAvailable = DEFAULT_SIM_PARAMETERS.maxRoomNightsPerMonth;
  const occupancyRate = randomFloat(0.58, 0.84, 4);
  const totalRoomsSold = Math.round(totalRoomsAvailable * occupancyRate);
  const weightedAdr =
    decision.priceBusinessTransient * 0.2 +
    decision.priceBusinessGroup * 0.15 +
    decision.priceLeisureTransient * 0.18 +
    decision.priceLeisureGroup * 0.12 +
    decision.priceGovernment * 0.1 +
    decision.priceOnlineOTA * 0.12 +
    decision.priceAirlineCrew * 0.05 +
    decision.priceLongStay * 0.08;
  const adr = roundTo(weightedAdr * randomFloat(0.92, 1.04, 4), 2);
  const revpar = roundTo(adr * occupancyRate, 2);
  const segmentResults = buildSegmentResults(decision, totalRoomsSold);
  const roomRevenue = roundTo(
    segmentResults.reduce((sum, segmentResult) => sum + segmentResult.revenue, 0),
    2
  );
  const fbRevenue = roundTo(roomRevenue * randomFloat(0.19, 0.29, 4), 2);
  const otherRevenue = roundTo(roomRevenue * randomFloat(0.05, 0.11, 4), 2);
  const totalRevenue = roundTo(roomRevenue + fbRevenue + otherRevenue, 2);
  const totalMarketing = roundTo(decision.marketingTotal * 10_000, 2);
  const totalCapex = roundTo(
    (decision.capexRenovation +
      decision.capexFurniture +
      decision.capexTechnology +
      decision.capexFacilities +
      decision.capexESGGreen) *
      10_000,
    2
  );
  const totalOpex = roundTo(
    (decision.opexRoomsMaintenance +
      decision.opexFoodBeverage +
      decision.opexFrontDesk +
      decision.opexHousekeeping +
      decision.opexUtilities +
      decision.opexStaffTraining +
      decision.opexStaffWelfare +
      decision.opexSecurity +
      decision.opexIT) *
      10_000 *
      randomFloat(1.08, 1.32, 4),
    2
  );
  const grossOperatingProfit = roundTo(totalRevenue - totalOpex - totalMarketing, 2);
  const ebitda = roundTo(grossOperatingProfit - randomInt(60_000, 160_000), 2);
  const totalDebtEnd = roundTo(
    hotelState.totalDebt + decision.newLoanAmount * 10_000 - decision.loanRepayment * 10_000,
    2
  );
  const depreciationExpense = roundTo(totalCapex * randomFloat(0.04, 0.08, 4) + 110_000, 2);
  const interestExpense = roundTo((totalDebtEnd * hotelState.debtInterestRate) / 12, 2);
  const profitBeforeTax = roundTo(ebitda - depreciationExpense - interestExpense, 2);
  const taxExpense =
    profitBeforeTax > 0
      ? roundTo(profitBeforeTax * DEFAULT_SIM_PARAMETERS.corporateTaxRate * randomFloat(0.4, 0.8, 4), 2)
      : 0;
  const netProfit = roundTo(profitBeforeTax - taxExpense, 2);
  const profitMargin = roundTo(netProfit / Math.max(totalRevenue, 1), 4);
  const brandReputationEnd = clamp(hotelState.brandReputation + randomInt(-2, 7), 0, 100);
  const onlineRatingEnd = clamp(roundTo(hotelState.onlineRating + randomFloat(-0.08, 0.18, 2), 2), 1, 5);
  const guestSatisfactionEnd = clamp(hotelState.guestSatisfaction + randomInt(-3, 8), 0, 100);
  const esgScoreEnd = clamp(hotelState.esgScore + randomInt(-1, 8), 0, 100);
  const cashBalanceEnd = roundTo(
    hotelState.cashBalance +
      netProfit -
      totalCapex +
      decision.newLoanAmount * 10_000 -
      decision.loanRepayment * 10_000,
    2
  );
  const equityEstimate = randomInt(82_000_000, 128_000_000);
  const debtToEquityRatio = roundTo(totalDebtEnd / equityEstimate, 2);
  const returnOnEquity = roundTo(netProfit / equityEstimate, 4);
  const overallMarketShare = roundTo(randomFloat(0.18, 0.31, 4), 4);
  const systemScoreBreakdown = calculateSystemScoreBreakdown({
    totalRevenue,
    netProfit,
    occupancyRate,
    guestSatisfactionEnd,
    esgScoreEnd,
  });
  const systemScore = systemScoreBreakdown.totalScore;
  const penaltyScore = 0;
  const finalScore = calculateFinalScore({
    systemScore,
    judgeScoreAverage: null,
    penaltyScore,
  });
  const explanationLog = buildSimulationExplanationLog({
    roundNumber,
    randomSeed: `seed-round:${roundNumber}`,
    rulesetVersion: buildDefaultRulesetConfig().version,
    totalRevenue,
    roomRevenue,
    fbRevenue,
    otherRevenue,
    totalOpex,
    totalMarketing,
    totalCapex,
    depreciationExpense,
    interestExpense,
    taxExpense,
    netProfit,
    occupancyRate,
    adr,
    revpar,
    averagePrice: adr,
    guestSatisfactionEnd,
    esgScoreEnd,
    brandReputationEnd,
    directMix: 0.46,
    serviceCapacityScore: 1.02,
    serviceStress: 0.03,
    turnoverLoadIndex: 0.97,
    demandCompressionIndex: 1.08,
    laborOvertimeFactor: 1.04,
    weatherUtilityPressure: 1.02,
    propertyTaxExpense: roundTo(totalRevenue * 0.002, 2),
    vatExpense: roundTo(totalRevenue * 0.004, 2),
    incomeTaxExpense: roundTo(Math.max(netProfit, 0) * 0.18, 2),
    channelAcquisitionCost: 0,
    channelCostRate: 0,
    ancillaryRevenueRatio: roundTo((fbRevenue + otherRevenue) / Math.max(roomRevenue, 1), 4),
    penaltyBreakdown: {
      liquidity: 0,
      leverage: 0,
      marketingAlignment: 0,
      channelAlignment: 0,
      taxRisk: 0,
      serviceStress: 0,
      total: 0,
    },
    segmentResults,
    systemScoreBreakdown,
  });

  return {
    roundNumber,
    occupancyRate,
    adr,
    revpar,
    totalRoomsSold,
    totalRoomsAvailable,
    segmentResults,
    roomRevenue,
    fbRevenue,
    otherRevenue,
    totalRevenue,
    totalOpex,
    totalMarketing,
    totalCapex,
    depreciationExpense,
    interestExpense,
    taxExpense,
    grossOperatingProfit,
    ebitda,
    netProfit,
    profitMargin,
    overallMarketShare,
    brandReputationEnd,
    onlineRatingEnd,
    guestSatisfactionEnd,
    esgScoreEnd,
    cashBalanceEnd,
    totalDebtEnd,
    debtToEquityRatio,
    returnOnEquity,
    systemScore,
    systemScoreBreakdown,
    penaltyScore,
    explanationLog,
    judgeScoreAverage: null,
    judgeScoreCount: 0,
    finalScore,
    teacherScore: null,
    teacherComment: null,
  };
}

// Ranking is derived after all results exist so later changes to score logic
// only need one edit point.
function assignRanks<T>(
  items: T[],
  valueSelector: (item: T) => number,
  targetKey: "rankRevenue" | "rankProfit" | "rankOccupancy" | "rankOverall"
) {
  const ranked = [...items]
    .map((item) => ({
      item,
      value: valueSelector(item),
    }))
    .sort((left, right) => right.value - left.value);

  ranked.forEach((entry, index) => {
    (entry.item as Record<typeof targetKey, number>)[targetKey] = index + 1;
  });
}

async function main() {
  // Public demo accounts and the privileged operator account use separate
  // credentials. The operator password is mandatory and is never logged.
  const publicDemoPassword = PUBLIC_DEMO_PASSWORD;
  const hiddenAdminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!publicDemoPassword) {
    throw new Error(
      "Seed aborted because NEXT_PUBLIC_DEMO_PASSWORD is required for public demo accounts."
    );
  }

  if (!hiddenAdminPassword) {
    throw new Error(
      "Seed aborted because SEED_ADMIN_PASSWORD is required for the administrator account."
    );
  }
  const publicPasswordHash = await hashPassword(publicDemoPassword);
  const hiddenAdminPasswordHash = await hashPassword(hiddenAdminPassword);

  await resetDatabase();

  // Core identities stay deterministic so the app always has one teacher,
  // judge, and admin available for smoke testing after each seed.
  const teacher = await prisma.user.create({
    data: {
      name: "Prof. Chen",
      email: "teacher@hotelsim.example",
      passwordHash: publicPasswordHash,
      role: UserRole.TEACHER,
      locale: Locale.ZH_CN,
      emailVerified: new Date("2026-03-01T00:00:00.000Z"),
    },
  });

  const admin = await prisma.user.create({
    data: {
      name: "Platform Admin",
      email: "admin@hotelsim.example",
      passwordHash: hiddenAdminPasswordHash,
      role: UserRole.ADMIN,
      locale: Locale.ZH_CN,
      emailVerified: new Date("2026-03-01T00:00:00.000Z"),
    },
  });

  const judge = await prisma.user.create({
    data: {
      name: "Judge Li",
      email: "judge@hotelsim.example",
      passwordHash: publicPasswordHash,
      role: UserRole.JUDGE,
      locale: Locale.ZH_CN,
      emailVerified: new Date("2026-03-01T00:00:00.000Z"),
    },
  });

  const totalStudentCount =
    seedProfile.activeClassTeamCount * seedProfile.studentsPerTeam + seedProfile.reserveStudentCount;

  if (totalStudentCount > studentNamePool.length) {
    throw new Error("Seed profile requires more student names than the pool currently contains.");
  }

  // Students are randomized from a controlled pool so names feel less fake,
  // but student ids and emails stay predictable for debugging and login tests.
  // Remote Supabase poolers are less forgiving than local Postgres instances,
  // so seed writes intentionally stay sequential to avoid flaky connection
  // spikes during handoff and CI-style runs.
  const students: Array<Awaited<ReturnType<typeof prisma.user.create>>> = [];
  const shuffledStudentNames = shuffle(studentNamePool).slice(0, totalStudentCount);
  for (let index = 0; index < shuffledStudentNames.length; index += 1) {
    const name = shuffledStudentNames[index];
    const studentNumber = String(index + 1).padStart(2, "0");
    const student = await prisma.user.create({
      data: {
        name,
        email: `student${studentNumber}@hotelsim.example`,
        passwordHash: publicPasswordHash,
        role: UserRole.STUDENT,
        studentId: `2026HS${studentNumber}`,
        locale: Locale.ZH_CN,
        emailVerified: new Date("2026-03-01T00:00:00.000Z"),
      },
    });

    students.push(student);
  }

  const activeSemester = await prisma.semester.create({
    data: {
      name: "2026 Spring Hotel Simulation",
      code: "HOTELSIM-2026-SPRING",
      creatorId: teacher.id,
      status: SemesterStatus.ACTIVE,
      description: "Clean showcase semester with seeded teams and no preserved operation history.",
      startDate: new Date("2026-03-01T00:00:00.000Z"),
      endDate: new Date("2027-02-28T00:00:00.000Z"),
    },
  });

  if (seedProfile.createDraftSemester) {
    await prisma.semester.create({
      data: {
        name: "2026 Fall Hotel Simulation",
        code: "HOTELSIM-2026-FALL",
        creatorId: teacher.id,
        status: SemesterStatus.DRAFT,
        description: "Draft semester kept for later teacher-side setup flows.",
        startDate: new Date("2026-09-01T00:00:00.000Z"),
        endDate: new Date("2027-01-31T00:00:00.000Z"),
      },
    });
  }

  const activeClass = await prisma.class.create({
    data: {
      semesterId: activeSemester.id,
      name: "Hotel Simulation Class A",
      joinCode: buildJoinCode("A"),
      maxTeams: seedProfile.activeClassTeamCount,
      minTeamSize: seedProfile.studentsPerTeam,
      maxTeamSize: seedProfile.studentsPerTeam,
      totalRooms: 500,
      currentRound: seedProfile.initializeFirstRound ? 1 : 0,
      maxRounds: seedProfile.maxRounds,
      status: seedProfile.initializeFirstRound ? ClassStatus.IN_PROGRESS : ClassStatus.SETUP,
      simParameters: DEFAULT_SIM_PARAMETERS,
    },
  });

  const defaultRulesetConfig = buildDefaultRulesetConfig();
  const defaultRuleset = await prisma.ruleset.create({
    data: {
      ...defaultRulesetConfig,
      status: RulesetStatus.ACTIVE,
    },
  });

  let competition:
    | Awaited<ReturnType<typeof prisma.competition.create>>
    | null = null;
  let competitionStage:
    | Awaited<ReturnType<typeof prisma.competitionStage.create>>
    | null = null;

  if (seedProfile.createCompetitionShell) {
    competition = await prisma.competition.create({
      data: {
        name: "2026 Hotel Simulation Invitational",
        code: "HOTELSIM-INV-2026",
        description:
          "Seeded competition shell kept intentionally clean so later比赛配置 can start from a fresh baseline.",
        status: CompetitionStatus.DRAFT,
        legacySemesterId: activeSemester.id,
        rulesetId: defaultRuleset.id,
        createdById: teacher.id,
        startDate: new Date("2026-03-01T00:00:00.000Z"),
        endDate: new Date("2026-06-30T00:00:00.000Z"),
      },
    });

    competitionStage = await prisma.competitionStage.create({
      data: {
        competitionId: competition.id,
        name: "Qualifiers",
        stageOrder: 1,
        status: CompetitionStageStatus.DRAFT,
        description: "Initial seeded stage kept clean for later competition setup.",
        maxRounds: seedProfile.maxRounds,
      },
    });
  }

  const shuffledTeamNames = shuffle(teamNamePool).slice(0, seedProfile.activeClassTeamCount);
  const shuffledHotelDescriptors = shuffle(hotelDescriptorPool);
  const teams = [];

  // The active class is the main demo playground:
  // - every team gets a hotel state
  // - every student is assigned to exactly one team
  // - role distribution is simple enough for UI/API work to consume directly
  for (let teamIndex = 0; teamIndex < shuffledTeamNames.length; teamIndex += 1) {
    const teamName = shuffledTeamNames[teamIndex];
    const memberStartIndex = teamIndex * seedProfile.studentsPerTeam;
    const memberIndices = Array.from({ length: seedProfile.studentsPerTeam }, (_, offset) => memberStartIndex + offset);
    const hotelState = buildHotelState();

    const team = await prisma.team.create({
      data: {
        classId: activeClass.id,
        name: `Team ${teamName}`,
        hotelName: `${teamName} ${shuffledHotelDescriptors[teamIndex % shuffledHotelDescriptors.length]}`,
        color: teamColorPool[teamIndex % teamColorPool.length],
        members: {
          create: memberIndices.map((studentIndex, memberOffset) => ({
            class: {
              connect: { id: activeClass.id },
            },
            user: {
              connect: { id: students[studentIndex].id },
            },
            role:
              memberOffset === 0
                ? TeamRole.LEADER
                : memberOffset === 1
                  ? TeamRole.MARKETING_MANAGER
                  : TeamRole.OPERATIONS_MANAGER,
          })),
        },
        hotelState: {
          create: hotelState,
        },
      },
      include: {
        hotelState: true,
        members: true,
      },
    });

    teams.push(team);
  }

  const rounds = [];

  if (seedProfile.initializeFirstRound) {
    const roundSnapshot = buildRoundRuntimeSnapshot({
      classConfig: activeClass,
      roundNumber: 1,
      ruleset: defaultRuleset,
    });

    const round = await prisma.round.create({
      data: {
        classId: activeClass.id,
        roundNumber: 1,
        status: RoundStatus.PENDING,
        seasonFactor: roundSeasonFactors[0],
        economyFactor: 1,
        eventFactor: 1,
        eventDescription: null,
        rulesetId: roundSnapshot.rulesetId ?? undefined,
        rulesetVersion: roundSnapshot.rulesetVersion,
        rulesetName: roundSnapshot.rulesetName,
        parameterSnapshot: roundSnapshot.parameterSnapshot,
        scoringSnapshot: roundSnapshot.scoringSnapshot,
        randomSeed: roundSnapshot.randomSeed,
        competitionStageId: competitionStage?.id ?? null,
        deadline: new Date(roundDeadlineDates[0]),
        processedAt: null,
      },
    });

    rounds.push(round);
  }

  await prisma.systemConfig.createMany({
    data: [
      { key: "simulation.defaultParameters", value: DEFAULT_SIM_PARAMETERS },
      { key: "simulation.defaultClassJoinCode", value: { joinCode: activeClass.joinCode } },
      {
        key: "competition.defaultRuleset",
        value: {
          rulesetId: defaultRuleset.id,
          name: defaultRuleset.name,
          version: defaultRuleset.version,
        },
      },
      {
        key: "seed.demoAccounts",
        value: {
          publicAccounts: [
            "teacher@hotelsim.example",
            "judge@hotelsim.example",
            "student01@hotelsim.example",
          ],
          hiddenAdminAccount: admin.email,
        },
      },
      ...(competition && competitionStage
        ? [
            {
              key: "competition.defaultCompetition",
              value: {
                competitionId: competition.id,
                competitionCode: competition.code,
                stageId: competitionStage.id,
              },
            },
          ]
        : []),
      {
        key: "seed.profile",
        value: {
          seed: rng.seedInput,
          activeClassTeamCount: seedProfile.activeClassTeamCount,
          studentsCreated: totalStudentCount,
          reserveStudents: seedProfile.reserveStudentCount,
          completedRounds: seedProfile.completedRounds,
          initializeFirstRound: seedProfile.initializeFirstRound,
          createCompetitionShell: seedProfile.createCompetitionShell,
        },
      },
    ],
  });

  // Keep seed output useful without printing any credential values.
  console.log("Seed complete.");
  console.log(`Seed random seed: ${rng.seedInput}`);
  console.log("Public demo accounts were created for teacher, judge, and student roles.");
  console.log("The administrator credential was supplied through SEED_ADMIN_PASSWORD.");
  console.log(`Active class join code: ${activeClass.joinCode}`);
  console.log(
    "Data profile: clean showcase baseline with 1 active semester, 1 active class, 2 teams, and no historical submissions/results."
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
