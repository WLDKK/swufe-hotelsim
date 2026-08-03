import type { Class, Decision, Prisma } from "@prisma/client";
import { ClassStatus } from "@prisma/client";
import { DEFAULT_SIM_PARAMETERS } from "@/lib/constants";
import {
  SEGMENT_PRICE_FIELD_MAP,
  buildSegmentDemandMap,
  calculateBrandReputation,
  calculateEsgScore,
  calculateGuestSatisfaction,
  calculateOnlineRating,
  calculateTeamAppeal,
  calculateTeamQualityIndex,
  getSegmentOperatingProfile,
  calculateWeightedAveragePrice,
  calculateWeightedChannelCostRate,
  clamp,
  roundTo,
  sumChannelMix,
  sumMarketingAllocation,
  type SimulationSegmentId,
} from "@/lib/simulation/formulas";
import { buildSimulationExplanationLog } from "@/lib/simulation/explanations";
import {
  calculateFinalScore,
  calculateSystemScoreBreakdown,
} from "@/lib/simulation/scoring";
import {
  buildRecommendedRoundEnvironment,
  parseEnvironmentDescription,
} from "@/lib/simulation/environment";
import type { SimulationInput } from "@/types";

type SimParameters = {
  [Key in keyof typeof DEFAULT_SIM_PARAMETERS]: number;
};
type TeamSimulationInput = SimulationInput["teams"][number];

type SegmentId = SimulationSegmentId;

type PreliminaryTeamResult = {
  teamId: string;
  result: {
    roundNumber: number;
    occupancyRate: number;
    adr: number;
    revpar: number;
    totalRoomsSold: number;
    totalRoomsAvailable: number;
    segmentResults: Prisma.InputJsonValue;
    roomRevenue: number;
    fbRevenue: number;
    otherRevenue: number;
    totalRevenue: number;
    totalOpex: number;
    totalMarketing: number;
    totalCapex: number;
    depreciationExpense: number;
    interestExpense: number;
    taxExpense: number;
    grossOperatingProfit: number;
    ebitda: number;
    netProfit: number;
    profitMargin: number;
    overallMarketShare: number;
    brandReputationEnd: number;
    onlineRatingEnd: number;
    guestSatisfactionEnd: number;
    esgScoreEnd: number;
    cashBalanceEnd: number;
    totalDebtEnd: number;
    debtToEquityRatio: number;
    returnOnEquity: number;
    rankRevenue: number;
    rankProfit: number;
    rankOccupancy: number;
    rankOverall: number;
    systemScore: number;
    systemScoreBreakdown: Prisma.InputJsonValue;
    penaltyScore: number;
    explanationLog: Prisma.InputJsonValue;
    judgeScoreAverage: null;
    judgeScoreCount: number;
    finalScore: number;
    teacherScore: null;
    teacherComment: null;
  };
  hotelStatePatch: Prisma.HotelStateUncheckedUpdateInput;
  overallScore: number;
};

type SegmentResultDraft = {
  segmentId: SegmentId;
  segmentName: string;
  demandAvailable: number;
  demandCaptured: number;
  roomsSold: number;
  revenue: number;
  marketShare: number;
  avgPrice: number;
};

type SegmentAllocationDraft = {
  segmentId: SegmentId;
  segmentName: string;
  price: number;
  demandAvailable: number;
  rawRoomsSold: number;
  roomsSold: number;
  demandCaptured: number;
  allocationScore: number;
};

type PenaltyBreakdown = {
  liquidity: number;
  leverage: number;
  marketingAlignment: number;
  channelAlignment: number;
  taxRisk: number;
  serviceStress: number;
  total: number;
};

function getNumericConfigValue(
  source: Record<string, unknown>,
  key: keyof SimParameters
) {
  const candidate = source[key];

  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : DEFAULT_SIM_PARAMETERS[key];
}

// Classes store simulation knobs in JSON so future tuning can happen without a
// schema migration. Resolve that JSON into a fully numeric config before the
// engine runs so every formula can trust it.
export function resolveSimulationParameters(classConfig: Class): SimParameters {
  const source =
    classConfig.simParameters && typeof classConfig.simParameters === "object"
      ? (classConfig.simParameters as Record<string, unknown>)
      : {};

  return {
    totalMarketDemandBase: getNumericConfigValue(source, "totalMarketDemandBase"),
    demandPerHotelBase: getNumericConfigValue(source, "demandPerHotelBase"),
    totalRooms:
      typeof source.totalRooms === "number" && Number.isFinite(source.totalRooms)
        ? source.totalRooms
        : classConfig.totalRooms,
    daysInMonth: getNumericConfigValue(source, "daysInMonth"),
    maxRoomNightsPerMonth: getNumericConfigValue(source, "maxRoomNightsPerMonth"),
    fbRevenueRatio: getNumericConfigValue(source, "fbRevenueRatio"),
    otherRevenueRatio: getNumericConfigValue(source, "otherRevenueRatio"),
    basePropertyTaxRate: getNumericConfigValue(source, "basePropertyTaxRate"),
    corporateTaxRate: getNumericConfigValue(source, "corporateTaxRate"),
    vatRate: getNumericConfigValue(source, "vatRate"),
    depreciationRate: getNumericConfigValue(source, "depreciationRate"),
    randomnessFactor: getNumericConfigValue(source, "randomnessFactor"),
    competitionIntensity: getNumericConfigValue(source, "competitionIntensity"),
    brandDecayRate: getNumericConfigValue(source, "brandDecayRate"),
    conditionDecayRate: getNumericConfigValue(source, "conditionDecayRate"),
    serviceStrainThreshold: getNumericConfigValue(source, "serviceStrainThreshold"),
    laborCostSensitivity: getNumericConfigValue(source, "laborCostSensitivity"),
    weatherEnergySensitivity: getNumericConfigValue(source, "weatherEnergySensitivity"),
    otaBillboardFactor: getNumericConfigValue(source, "otaBillboardFactor"),
    directBookingLift: getNumericConfigValue(source, "directBookingLift"),
    facilitiesUpsellFactor: getNumericConfigValue(source, "facilitiesUpsellFactor"),
  };
}

// Stage 7 adds an explicit calibration layer between class-stored knobs and
// the live engine formulas. That keeps today's simplified engine playable
// while also giving the teacher formula handoff a single place to replace or
// refine parameter normalization later.
export function calibrateSimulationParameters(
  parameters: SimParameters,
  teamCount: number
) {
  const normalizedTeamCount = Math.max(teamCount, 1);
  const marketSignal = parameters.totalMarketDemandBase * normalizedTeamCount;
  const hotelSignal =
    parameters.demandPerHotelBase *
    normalizedTeamCount *
    parameters.daysInMonth;

  return {
    ...parameters,
    totalMarketDemandBase: roundTo((marketSignal + hotelSignal) / 2, 2),
  } satisfies SimParameters;
}

export function getCalibratedSimulationParameters(
  classConfig: Class,
  teamCount: number
) {
  return calibrateSimulationParameters(
    resolveSimulationParameters(classConfig),
    teamCount
  );
}

function getPriceForSegment(decision: Decision, segmentId: SegmentId) {
  return decision[SEGMENT_PRICE_FIELD_MAP[segmentId]];
}

function calculatePenaltyBreakdown(input: {
  decision: Decision;
  cashBalanceEnd: number;
  debtToEquityRatio: number;
  guestSatisfactionEnd: number;
}) {
  const marketingGapRatio =
    Math.abs(
      input.decision.marketingTotal - sumMarketingAllocation(input.decision)
    ) / Math.max(input.decision.marketingTotal, 1);
  const channelGapRatio =
    Math.abs(100 - sumChannelMix(input.decision)) / 100;
  const liquidity = input.cashBalanceEnd < 0
    ? clamp(6 + Math.abs(input.cashBalanceEnd) / 1_500_000, 6, 18)
    : 0;
  const leverage = input.debtToEquityRatio > 1.6
    ? clamp((input.debtToEquityRatio - 1.6) * 10, 0, 10)
    : 0;
  const marketingAlignment = clamp(marketingGapRatio * 14, 0, 8);
  const channelAlignment = clamp(channelGapRatio * 18, 0, 8);
  const taxRisk =
    input.decision.taxStrategy === "INCENTIVE_FOCUS" &&
    input.debtToEquityRatio > 1.4
      ? 3
      : 0;
  const serviceStress =
    input.guestSatisfactionEnd < 70
      ? clamp((70 - input.guestSatisfactionEnd) * 0.3, 0, 6)
      : 0;

  return {
    liquidity: roundTo(liquidity, 2),
    leverage: roundTo(leverage, 2),
    marketingAlignment: roundTo(marketingAlignment, 2),
    channelAlignment: roundTo(channelAlignment, 2),
    taxRisk: roundTo(taxRisk, 2),
    serviceStress: roundTo(serviceStress, 2),
    total: roundTo(
      liquidity +
        leverage +
        marketingAlignment +
        channelAlignment +
        taxRisk +
        serviceStress,
      2
    ),
  } satisfies PenaltyBreakdown;
}

function calculateServiceCapacityScore(input: {
  decision: Decision;
  hotelState: TeamSimulationInput["hotelState"];
  occupancyRate: number;
  parameters: SimParameters;
}) {
  const staffingInvestment =
    input.decision.opexFrontDesk +
    input.decision.opexHousekeeping +
    input.decision.opexStaffTraining +
    input.decision.opexStaffWelfare;
  const coverageBaseline = 42 + input.occupancyRate * 34;
  const staffingCoverage = clamp(
    staffingInvestment / Math.max(coverageBaseline, 1),
    0.72,
    1.24
  );
  const trainingSupport =
    input.hotelState.staffTrainingLevel / 100 * 0.12 +
    input.hotelState.staffMorale / 100 * 0.1;
  const digitalAssist = input.hotelState.technologyLevel / 100 * 0.08;

  return clamp(staffingCoverage + trainingSupport + digitalAssist, 0.78, 1.22);
}

function calculateWeatherUtilityPressure(input: {
  round: SimulationInput["round"];
  parameters: SimParameters;
}) {
  const parsed = parseEnvironmentDescription(input.round.eventDescription);
  const weatherLabel = parsed.weatherLabel ?? "";
  const seasonalLoad = Math.max(0, Math.abs(input.round.seasonFactor - 1) * 0.35);
  const explicitWeatherLoad =
    weatherLabel === "高温炎热" || weatherLabel === "寒潮降温"
      ? 1
      : weatherLabel === "连续降雨"
        ? 0.45
        : 0.15;

  return clamp(
    1 +
      (seasonalLoad + explicitWeatherLoad * 0.18) *
        input.parameters.weatherEnergySensitivity,
    0.95,
    1.18
  );
}

function calculateTotalRoomsAvailable(input: {
  classConfig: SimulationInput["classConfig"];
  parameters: SimParameters;
}) {
  const configuredRooms = Math.max(
    1,
    Math.round(input.parameters.totalRooms || input.classConfig.totalRooms)
  );
  const theoreticalRoomNights = configuredRooms * input.parameters.daysInMonth;

  // maxRoomNightsPerMonth is intended to cap sellable inventory rather than
  // inflate it. Clamp theoretical capacity so tuning stays realistic.
  return Math.max(
    1,
    Math.floor(
      Math.min(theoreticalRoomNights, input.parameters.maxRoomNightsPerMonth)
    )
  );
}

function calculateSegmentAllocationScore(input: {
  price: number;
  weightedChannelCostRate: number;
  parameters: SimParameters;
  segmentId: SegmentId;
}) {
  const profile = getSegmentOperatingProfile(input.segmentId);
  const netRoomRate = input.price * (1 - input.weightedChannelCostRate);
  const ancillarySupport =
    input.price *
    (input.parameters.fbRevenueRatio * profile.fbSpendWeight * 0.72 +
      input.parameters.otherRevenueRatio * profile.otherSpendWeight * 0.58);
  const turnoverPenalty = clamp(
    input.price * 0.085 * profile.serviceLoadWeight,
    12,
    64
  );
  const strategicPriorityBoost = profile.yieldPriorityWeight * 26;

  // Real hotels under compression protect the highest net-yield and most
  // strategic business first instead of scaling every segment proportionally.
  return roundTo(
    netRoomRate + ancillarySupport + strategicPriorityBoost - turnoverPenalty,
    4
  );
}

function allocateRoomNightsByYieldPriority(
  drafts: SegmentAllocationDraft[],
  totalRoomsAvailable: number
) {
  const prioritized = [...drafts].sort(
    (left, right) =>
      right.allocationScore - left.allocationScore || right.price - left.price
  );
  let remainingRooms = totalRoomsAvailable;
  const allocated = new Map<
    SegmentId,
    {
      roomsSold: number;
      demandCaptured: number;
      fraction: number;
      allocationScore: number;
      price: number;
    }
  >();

  for (const item of prioritized) {
    if (remainingRooms <= 0) {
      allocated.set(item.segmentId, {
        roomsSold: 0,
        demandCaptured: 0,
        fraction: 0,
        allocationScore: item.allocationScore,
        price: item.price,
      });
      continue;
    }

    const demandCaptured = Math.min(item.rawRoomsSold, remainingRooms);
    const baseRoomsSold = Math.min(Math.floor(demandCaptured), remainingRooms);

    allocated.set(item.segmentId, {
      roomsSold: baseRoomsSold,
      demandCaptured,
      fraction: demandCaptured - baseRoomsSold,
      allocationScore: item.allocationScore,
      price: item.price,
    });
    remainingRooms -= baseRoomsSold;
  }

  if (remainingRooms > 0) {
    const fractionalPriority = prioritized
      .map((item) => {
        const entry = allocated.get(item.segmentId);

        return {
          segmentId: item.segmentId,
          fraction: entry?.fraction ?? 0,
          roomsSold: entry?.roomsSold ?? 0,
          demandCaptured: entry?.demandCaptured ?? 0,
          allocationScore: entry?.allocationScore ?? item.allocationScore,
          price: entry?.price ?? item.price,
        };
      })
      .filter((item) => item.fraction > 0)
      .sort(
        (left, right) =>
          right.fraction - left.fraction ||
          right.allocationScore - left.allocationScore ||
          right.price - left.price
      );

    for (const candidate of fractionalPriority) {
      if (remainingRooms <= 0) {
        break;
      }

      const entry = allocated.get(candidate.segmentId);

      if (!entry || entry.roomsSold >= Math.ceil(entry.demandCaptured)) {
        continue;
      }

      entry.roomsSold += 1;
      remainingRooms -= 1;
    }
  }

  return drafts.map((item) => {
    const entry = allocated.get(item.segmentId);

    return {
      ...item,
      roomsSold: entry?.roomsSold ?? 0,
      demandCaptured: roundTo(entry?.demandCaptured ?? 0, 2),
    };
  });
}

function simulateTeamPerformance(
  input: SimulationInput,
  teamInput: TeamSimulationInput,
  segmentDemands: ReturnType<typeof buildSegmentDemandMap>,
  appealShares: Map<string, Record<string, number>>,
  parameters: SimParameters
) {
  const { decision, hotelState, team } = teamInput;
  const totalRoomsAvailable = calculateTotalRoomsAvailable({
    classConfig: input.classConfig,
    parameters,
  });
  const weightedChannelCostRate = calculateWeightedChannelCostRate(decision);

  const qualityIndex = calculateTeamQualityIndex(hotelState);

  const segmentDraft: SegmentAllocationDraft[] = segmentDemands.map(
    ({ segment, totalDemand }) => {
      const segmentId = segment.id as SegmentId;
      const price = getPriceForSegment(decision, segmentId);
      const segmentShare = appealShares.get(team.id)?.[segment.id] ?? 0;
      const demandAvailable = totalDemand * segmentShare;

      return {
        segmentId,
        segmentName: segment.nameEn,
        price,
        demandAvailable,
        rawRoomsSold: Math.max(demandAvailable, 0),
        roomsSold: 0,
        demandCaptured: 0,
        allocationScore: calculateSegmentAllocationScore({
          price,
          weightedChannelCostRate,
          parameters,
          segmentId,
        }),
      };
    }
  );

  const rawRoomsSoldTotal = segmentDraft.reduce(
    (sum, item) => sum + item.rawRoomsSold,
    0
  );
  const demandCompressionIndex = roundTo(
    rawRoomsSoldTotal / Math.max(totalRoomsAvailable, 1),
    4
  );
  const allocatedSegments = allocateRoomNightsByYieldPriority(
    segmentDraft,
    totalRoomsAvailable
  );

  const segmentResults: SegmentResultDraft[] = allocatedSegments.map((item) => {
    const revenue = roundTo(item.roomsSold * item.price, 2);

    return {
      segmentId: item.segmentId,
      segmentName: item.segmentName,
      demandAvailable: roundTo(item.demandAvailable, 2),
      demandCaptured: item.demandCaptured,
      roomsSold: item.roomsSold,
      revenue,
      marketShare: 0,
      avgPrice: item.price,
    };
  });

  const totalRoomsSold = segmentResults.reduce((sum, item) => sum + item.roomsSold, 0);
  const roomRevenue = roundTo(
    segmentResults.reduce((sum, item) => sum + item.revenue, 0),
    2
  );
  const occupancyRate = roundTo(totalRoomsSold / Math.max(totalRoomsAvailable, 1), 4);
  const adr = roundTo(roomRevenue / Math.max(totalRoomsSold, 1), 2);
  const revpar = roundTo(adr * occupancyRate, 2);
  const groupMix = roundTo(
    segmentResults
      .filter((segmentResult) =>
        ["business_group", "leisure_group"].includes(segmentResult.segmentId)
      )
      .reduce((sum, segmentResult) => sum + segmentResult.roomsSold, 0) /
      Math.max(totalRoomsSold, 1),
    4
  );
  const longStayMix = roundTo(
    (segmentResults.find((segmentResult) => segmentResult.segmentId === "long_stay")
      ?.roomsSold ?? 0) / Math.max(totalRoomsSold, 1),
    4
  );
  const turnoverLoadIndex = roundTo(
    segmentResults.reduce((sum, segmentResult) => {
      const profile = getSegmentOperatingProfile(segmentResult.segmentId);
      return (
        sum +
        (segmentResult.roomsSold / Math.max(totalRoomsSold, 1)) *
          profile.serviceLoadWeight
      );
    }, 0),
    4
  );
  const fbMixIndex = roundTo(
    segmentResults.reduce((sum, segmentResult) => {
      const profile = getSegmentOperatingProfile(segmentResult.segmentId);
      return (
        sum +
        (segmentResult.roomsSold / Math.max(totalRoomsSold, 1)) *
          profile.fbSpendWeight
      );
    }, 0),
    4
  );
  const otherRevenueMixIndex = roundTo(
    segmentResults.reduce((sum, segmentResult) => {
      const profile = getSegmentOperatingProfile(segmentResult.segmentId);
      return (
        sum +
        (segmentResult.roomsSold / Math.max(totalRoomsSold, 1)) *
          profile.otherSpendWeight
      );
    }, 0),
    4
  );
  const directMix = roundTo(
    (decision.channelDirect + decision.channelCorporate + decision.channelGDS) / 100,
    4
  );
  const averagePrice = calculateWeightedAveragePrice(decision);
  const propertyConditionEnd = clamp(
    hotelState.propertyCondition * (1 - parameters.conditionDecayRate * 0.65) +
      decision.capexRenovation * 0.42 +
      decision.capexFacilities * 0.16 +
      decision.opexRoomsMaintenance * 0.14 -
      occupancyRate * 2.8,
    0,
    100
  );
  const furnitureConditionEnd = clamp(
    hotelState.furnitureCondition * 0.975 +
      decision.capexFurniture * 0.48 +
      decision.capexFacilities * 0.14 +
      decision.opexHousekeeping * 0.09 -
      occupancyRate * 1.8,
    0,
    100
  );
  const technologyLevelEnd = clamp(
    hotelState.technologyLevel * 0.982 +
      decision.capexTechnology * 0.68 +
      decision.opexIT * 0.08,
    0,
    100
  );
  const energyEfficiencyEnd = clamp(
    hotelState.energyEfficiency * 0.985 +
      decision.esgEnergyInvestment * 0.1 +
      decision.capexESGGreen * 0.28,
    0,
    100
  );
  const staffTrainingLevelEnd = clamp(
    hotelState.staffTrainingLevel * 0.975 + decision.opexStaffTraining * 0.32,
    0,
    100
  );
  const staffMoraleEnd = clamp(
    hotelState.staffMorale * 0.96 +
      decision.opexStaffWelfare * 0.42 +
      decision.opexStaffTraining * 0.12 -
      occupancyRate * 2.6,
    0,
    100
  );
  const baseGuestSatisfaction = calculateGuestSatisfaction(
    decision,
    hotelState,
    qualityIndex,
    occupancyRate
  );
  const serviceCapacityScore = calculateServiceCapacityScore({
    decision,
    hotelState,
    occupancyRate,
    parameters,
  });
  // Real hotels do not turn occupancy into profit linearly: once the house is
  // too full relative to staffing support, overtime, slower service recovery,
  // and satisfaction drag show up quickly.
  const serviceStress = clamp(
    Math.max(0, occupancyRate - parameters.serviceStrainThreshold) *
      (1.1 +
        (1 - serviceCapacityScore) * parameters.laborCostSensitivity * 2.4 +
        Math.max(0, turnoverLoadIndex - 1) * 0.6),
    0,
    0.24
  );
  const guestSatisfactionEnd = clamp(
    baseGuestSatisfaction +
      serviceCapacityScore * 4.5 +
      (technologyLevelEnd / 100) * 3 -
      serviceStress * 42,
    0,
    100
  );
  const brandReputationEnd = clamp(
    calculateBrandReputation(
      decision,
      hotelState,
      guestSatisfactionEnd,
      parameters
    ) -
      serviceStress * 10,
    0,
    100
  );
  const esgScoreEnd = calculateEsgScore(decision, hotelState);
  const onlineRatingEnd = calculateOnlineRating(
    hotelState,
    guestSatisfactionEnd,
    brandReputationEnd
  );
  const facilitiesYieldBoost = clamp(
    1 +
      parameters.facilitiesUpsellFactor *
        (groupMix * 0.6 + decision.capexFacilities / 20),
    1,
    1.14
  );
  const directBookingRevenueBoost = clamp(
    1 +
      directMix *
        parameters.directBookingLift *
        (0.45 + technologyLevelEnd / 200 + brandReputationEnd / 200),
    1,
    1.08
  );
  const effectiveFbRevenueRatio = clamp(
    (parameters.fbRevenueRatio +
      (fbMixIndex - 1) * 0.14 +
      groupMix * 0.16 +
      occupancyRate * 0.05 +
      (guestSatisfactionEnd / 100) * 0.04 +
      (decision.opexFoodBeverage / 100) * 0.08 +
      (decision.capexFacilities / 100) * parameters.facilitiesUpsellFactor * 0.8) *
      facilitiesYieldBoost,
    0.18,
    0.54
  );
  const effectiveOtherRevenueRatio = clamp(
    (parameters.otherRevenueRatio +
      (otherRevenueMixIndex - 1) * 0.08 +
      longStayMix * 0.05 +
      directMix * parameters.directBookingLift * 0.35 +
      (brandReputationEnd / 100) * 0.05 +
      (technologyLevelEnd / 100) * 0.03) *
      directBookingRevenueBoost,
    0.06,
    0.24
  );
  const fbRevenue = roundTo(roomRevenue * effectiveFbRevenueRatio, 2);
  const otherRevenue = roundTo(roomRevenue * effectiveOtherRevenueRatio, 2);
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
  const channelAcquisitionCost = roundTo(roomRevenue * weightedChannelCostRate, 2);
  const laborOvertimeFactor = clamp(
    1 + serviceStress * (1.2 + parameters.laborCostSensitivity * 2.4),
    1,
    1.3
  );
  const roomsDepartmentExpense = roundTo(
    ((decision.opexRoomsMaintenance +
      decision.opexFrontDesk +
      decision.opexHousekeeping) *
      10_000 *
      clamp(0.88 + occupancyRate * 0.24 + (turnoverLoadIndex - 1) * 0.18, 0.88, 1.24) +
      totalRoomsSold * clamp(adr * 0.09, 32, 108)) *
      laborOvertimeFactor,
    2
  );
  const fbDepartmentExpense = roundTo(
    decision.opexFoodBeverage *
      10_000 *
      clamp(0.94 + groupMix * 0.22 + occupancyRate * 0.14, 0.9, 1.24) +
      fbRevenue * clamp(0.31 + groupMix * 0.06, 0.31, 0.4),
    2
  );
  const energySavingsFactor = clamp(
    1 - Math.max(0, (energyEfficiencyEnd - 50) / 50) * 0.18,
    0.82,
    1.04
  );
  const weatherUtilityPressure = calculateWeatherUtilityPressure({
    round: input.round,
    parameters,
  });
  const utilitiesExpense = roundTo(
    decision.opexUtilities *
      10_000 *
      clamp(0.88 + occupancyRate * 0.22, 0.86, 1.14) *
      energySavingsFactor *
      weatherUtilityPressure,
    2
  );
  const supportExpense = roundTo(
    (decision.opexStaffTraining +
      decision.opexStaffWelfare +
      decision.opexSecurity +
      decision.opexIT) *
      10_000 *
      clamp(0.94 + occupancyRate * 0.08, 0.9, 1.08) *
      clamp(0.96 + serviceStress * 0.9, 0.96, 1.18),
    2
  );
  const totalOpex = roundTo(
    roomsDepartmentExpense +
      fbDepartmentExpense +
      utilitiesExpense +
      supportExpense +
      channelAcquisitionCost,
    2
  );
  const grossOperatingProfit = roundTo(totalRevenue - totalOpex - totalMarketing, 2);
  const ebitda = grossOperatingProfit;
  const totalDebtEnd = roundTo(
    Math.max(
      0,
      hotelState.totalDebt +
        decision.newLoanAmount * 10_000 -
        decision.loanRepayment * 10_000
    ),
    2
  );
  const roomInventory = Math.max(
    1,
    Math.round(parameters.totalRooms || input.classConfig.totalRooms)
  );
  const depreciationExpense = roundTo(
    Math.max(
      70_000,
      totalCapex * parameters.depreciationRate + roomInventory * 110
    ),
    2
  );
  const leveragePremium = clamp(
    Math.max(0, totalDebtEnd - 260_000_000) / 260_000_000,
    0,
    0.18
  );
  const interestExpense = roundTo(
    Math.max(
      0,
      (totalDebtEnd * (hotelState.debtInterestRate + leveragePremium * 0.01)) / 12
    ),
    2
  );
  const profitBeforeTax = roundTo(ebitda - depreciationExpense - interestExpense, 2);
  const taxStrategyFactor =
    decision.taxStrategy === "INCENTIVE_FOCUS"
      ? 0.86
      : decision.taxStrategy === "COMPLIANCE_FIRST"
        ? 1.02
        : 0.94;
  const propertyTaxExpense = roundTo(
    roomInventory *
      clamp(propertyConditionEnd / 100, 0.8, 1.08) *
      1_800 *
      parameters.basePropertyTaxRate,
    2
  );
  const vatExpense = roundTo(
    (roomRevenue + fbRevenue * 0.8 + otherRevenue * 0.6) *
      parameters.vatRate *
      0.16,
    2
  );
  const incomeTaxExpense =
    profitBeforeTax > 0
      ? roundTo(profitBeforeTax * parameters.corporateTaxRate * taxStrategyFactor, 2)
      : 0;
  // Preserve one aggregate tax line for UI compatibility, but compose it from
  // property tax, indirect tax drag, and income tax so parameter tuning can
  // represent more realistic hotel cost structure.
  const taxExpense = roundTo(propertyTaxExpense + vatExpense + incomeTaxExpense, 2);
  const netProfit = roundTo(profitBeforeTax - taxExpense, 2);
  const profitMargin = roundTo(netProfit / Math.max(totalRevenue, 1), 4);
  const cashBalanceEnd = roundTo(
    hotelState.cashBalance +
      netProfit -
      totalCapex +
      decision.newLoanAmount * 10_000 -
      decision.loanRepayment * 10_000,
    2
  );
  const accumulatedProfitEnd = roundTo(hotelState.accumulatedProfit + netProfit, 2);
  const equityEstimate = Math.max(80_000_000, 120_000_000 + accumulatedProfitEnd);
  const debtToEquityRatio = roundTo(totalDebtEnd / Math.max(equityEstimate, 1), 2);
  const returnOnEquity = roundTo(netProfit / Math.max(equityEstimate, 1), 4);
  const penaltyBreakdown = calculatePenaltyBreakdown({
    decision,
    cashBalanceEnd,
    debtToEquityRatio,
    guestSatisfactionEnd,
  });
  const systemScoreBreakdown = calculateSystemScoreBreakdown({
    totalRevenue,
    netProfit,
    occupancyRate,
    esgScoreEnd,
    guestSatisfactionEnd,
    scoringSnapshot: input.round.scoringSnapshot,
  });
  const systemScore = systemScoreBreakdown.totalScore;
  const penaltyScore = penaltyBreakdown.total;
  const finalScore = calculateFinalScore({
    systemScore,
    judgeScoreAverage: null,
    penaltyScore,
    scoringSnapshot: input.round.scoringSnapshot,
  });
  const explanationLog = buildSimulationExplanationLog({
    roundNumber: input.round.roundNumber,
    randomSeed: input.round.randomSeed ?? null,
    rulesetVersion: input.round.rulesetVersion ?? null,
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
    averagePrice,
    guestSatisfactionEnd,
    esgScoreEnd,
    brandReputationEnd,
    directMix,
    serviceCapacityScore,
    serviceStress,
    turnoverLoadIndex,
    demandCompressionIndex,
    laborOvertimeFactor,
    weatherUtilityPressure,
    propertyTaxExpense,
    vatExpense,
    incomeTaxExpense,
    channelAcquisitionCost,
    channelCostRate: weightedChannelCostRate,
    ancillaryRevenueRatio: roundTo((fbRevenue + otherRevenue) / Math.max(roomRevenue, 1), 4),
    penaltyBreakdown,
    segmentResults: segmentResults,
    systemScoreBreakdown,
  });

  return {
    teamId: team.id,
    result: {
      roundNumber: input.round.roundNumber,
      occupancyRate,
      adr,
      revpar,
      totalRoomsSold,
      totalRoomsAvailable,
      segmentResults: segmentResults as unknown as Prisma.InputJsonValue,
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
      overallMarketShare: 0,
      brandReputationEnd: roundTo(brandReputationEnd, 2),
      onlineRatingEnd: roundTo(onlineRatingEnd, 2),
      guestSatisfactionEnd: roundTo(guestSatisfactionEnd, 2),
      esgScoreEnd: roundTo(esgScoreEnd, 2),
      cashBalanceEnd,
      totalDebtEnd,
      debtToEquityRatio,
      returnOnEquity,
      rankRevenue: 0,
      rankProfit: 0,
      rankOccupancy: 0,
      rankOverall: 0,
      systemScore,
      systemScoreBreakdown: systemScoreBreakdown as unknown as Prisma.InputJsonValue,
      penaltyScore,
      explanationLog: explanationLog as unknown as Prisma.InputJsonValue,
      judgeScoreAverage: null,
      judgeScoreCount: 0,
      finalScore,
      teacherScore: null,
      teacherComment: null,
    },
    hotelStatePatch: {
      cashBalance: cashBalanceEnd,
      totalDebt: totalDebtEnd,
      accumulatedProfit: accumulatedProfitEnd,
      propertyCondition: roundTo(propertyConditionEnd, 2),
      furnitureCondition: roundTo(furnitureConditionEnd, 2),
      technologyLevel: roundTo(technologyLevelEnd, 2),
      brandReputation: roundTo(brandReputationEnd, 2),
      onlineRating: roundTo(onlineRatingEnd, 2),
      guestSatisfaction: roundTo(guestSatisfactionEnd, 2),
      esgScore: roundTo(esgScoreEnd, 2),
      energyEfficiency: roundTo(energyEfficiencyEnd, 2),
      staffMorale: roundTo(staffMoraleEnd, 2),
      staffTrainingLevel: roundTo(staffTrainingLevelEnd, 2),
      lastUpdatedRound: input.round.roundNumber,
    },
    overallScore: finalScore,
  } satisfies PreliminaryTeamResult;
}

function assignRank(
  items: PreliminaryTeamResult[],
  valueSelector: (item: PreliminaryTeamResult) => number,
  key: "rankRevenue" | "rankProfit" | "rankOccupancy" | "rankOverall"
) {
  [...items]
    .sort((left, right) => valueSelector(right) - valueSelector(left))
    .forEach((entry, index) => {
      entry.result[key] = index + 1;
    });
}

export function runRoundSimulation(input: SimulationInput) {
  const parameters = getCalibratedSimulationParameters(
    input.classConfig,
    input.teams.length
  );
  const segmentDemands = buildSegmentDemandMap(input, parameters);
  const appealShares = new Map<string, Record<string, number>>();

  for (const { segment, totalDemand } of segmentDemands) {
    const rawAppeals = input.teams.map(({ team, decision, hotelState }) => {
      return {
        teamId: team.id,
        appeal: calculateTeamAppeal({
          segment,
          totalDemand,
          decision,
          hotelState,
          teamId: team.id,
          roundNumber: input.round.roundNumber,
          parameters,
        }),
      };
    });

    const totalAppeal = rawAppeals.reduce((sum, entry) => sum + entry.appeal, 0);
    const fallbackShare = 1 / Math.max(rawAppeals.length, 1);

    for (const entry of rawAppeals) {
      const normalizedShare =
        totalAppeal > 0 ? entry.appeal / totalAppeal : fallbackShare;
      const smoothedShare =
        normalizedShare * parameters.competitionIntensity +
        fallbackShare * (1 - parameters.competitionIntensity);
      const existing = appealShares.get(entry.teamId) ?? {};
      existing[segment.id] = smoothedShare;
      appealShares.set(entry.teamId, existing);
    }
  }

  const processed = input.teams.map((teamInput) =>
    simulateTeamPerformance(input, teamInput, segmentDemands, appealShares, parameters)
  );

  const totalRoomsSoldAllTeams = processed.reduce(
    (sum, item) => sum + item.result.totalRoomsSold,
    0
  );

  for (const item of processed) {
    item.result.overallMarketShare = roundTo(
      item.result.totalRoomsSold / Math.max(totalRoomsSoldAllTeams, 1),
      4
    );

    const segmentResults = item.result.segmentResults as unknown as SegmentResultDraft[];
    item.result.segmentResults = segmentResults.map((segmentResult) => ({
      ...segmentResult,
      marketShare: roundTo(
        segmentResult.roomsSold / Math.max(item.result.totalRoomsSold, 1),
        4
      ),
    })) as unknown as Prisma.InputJsonValue;
  }

  assignRank(processed, (item) => item.result.totalRevenue, "rankRevenue");
  assignRank(processed, (item) => item.result.netProfit, "rankProfit");
  assignRank(processed, (item) => item.result.occupancyRate, "rankOccupancy");
  assignRank(processed, (item) => item.overallScore, "rankOverall");

  return processed;
}

// Newly created classes have no rounds yet. This helper provides the initial
// round scenario so Stage 3 can bootstrap a class into the simulation cycle
// without relying on ad-hoc manual database edits.
export function buildDefaultRoundScenario(roundNumber: number) {
  const recommendation = buildRecommendedRoundEnvironment({ roundNumber });

  return {
    roundNumber,
    seasonFactor: recommendation.seasonFactor,
    economyFactor: recommendation.economyFactor,
    eventFactor: recommendation.eventFactor,
    eventDescription: recommendation.eventDescription,
    deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
  };
}

export function getNextClassStatus(
  classRecord: Pick<Class, "currentRound" | "maxRounds" | "status">
) {
  if (classRecord.currentRound >= classRecord.maxRounds) {
    return {
      nextRoundNumber: classRecord.currentRound,
      classStatus: ClassStatus.COMPLETED,
    };
  }

  return {
    nextRoundNumber: Math.max(1, classRecord.currentRound + 1),
    classStatus:
      classRecord.status === ClassStatus.SETUP
        ? ClassStatus.IN_PROGRESS
        : classRecord.status,
  };
}
