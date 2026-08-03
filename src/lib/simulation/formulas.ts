import type { Decision, HotelState } from "@prisma/client";
import { MARKET_SEGMENTS, type MarketSegment, type SimParameters } from "@/lib/constants";
import { parseEnvironmentDescription } from "@/lib/simulation/environment";
import type { SimulationInput } from "@/types";

export const SEGMENT_MARKETING_FIELD_MAP = {
  business_transient: "mktBudgetBusinessTransient",
  business_group: "mktBudgetBusinessGroup",
  leisure_transient: "mktBudgetLeisureTransient",
  leisure_group: "mktBudgetLeisureGroup",
  government: "mktBudgetGovernment",
  online_ota: "mktBudgetOnlineOTA",
  airline_crew: "mktBudgetAirlineCrew",
  long_stay: "mktBudgetLongStay",
} as const;

export const SEGMENT_PRICE_FIELD_MAP = {
  business_transient: "priceBusinessTransient",
  business_group: "priceBusinessGroup",
  leisure_transient: "priceLeisureTransient",
  leisure_group: "priceLeisureGroup",
  government: "priceGovernment",
  online_ota: "priceOnlineOTA",
  airline_crew: "priceAirlineCrew",
  long_stay: "priceLongStay",
} as const;

export type SimulationSegmentId =
  keyof typeof SEGMENT_MARKETING_FIELD_MAP & keyof typeof SEGMENT_PRICE_FIELD_MAP;

type SegmentPriceFieldMap = typeof SEGMENT_PRICE_FIELD_MAP;
type SegmentMarketingFieldMap = typeof SEGMENT_MARKETING_FIELD_MAP;
type SegmentId = keyof SegmentPriceFieldMap & keyof SegmentMarketingFieldMap;

type FormulaManifestEntry = {
  id: string;
  title: string;
  purpose: string;
  outputs: string[];
  parameterKeys: Array<keyof SimParameters>;
  teacherHandoffReady: boolean;
};

const CHANNEL_COST_RATE = {
  direct: 0.02,
  ota: 0.18,
  travelAgent: 0.1,
  corporate: 0.055,
  gds: 0.075,
} as const;

const CHANNEL_FIT_WEIGHTS: Record<
  SegmentId,
  {
    direct: number;
    ota: number;
    travelAgent: number;
    corporate: number;
    gds: number;
  }
> = {
  business_transient: {
    direct: 0.28,
    ota: 0.08,
    travelAgent: 0.08,
    corporate: 0.34,
    gds: 0.22,
  },
  business_group: {
    direct: 0.16,
    ota: 0.05,
    travelAgent: 0.18,
    corporate: 0.44,
    gds: 0.17,
  },
  leisure_transient: {
    direct: 0.18,
    ota: 0.54,
    travelAgent: 0.12,
    corporate: 0.06,
    gds: 0.1,
  },
  leisure_group: {
    direct: 0.14,
    ota: 0.2,
    travelAgent: 0.42,
    corporate: 0.08,
    gds: 0.16,
  },
  government: {
    direct: 0.18,
    ota: 0.08,
    travelAgent: 0.16,
    corporate: 0.36,
    gds: 0.22,
  },
  online_ota: {
    direct: 0.05,
    ota: 0.82,
    travelAgent: 0.05,
    corporate: 0.03,
    gds: 0.05,
  },
  airline_crew: {
    direct: 0.12,
    ota: 0.06,
    travelAgent: 0.08,
    corporate: 0.36,
    gds: 0.38,
  },
  long_stay: {
    direct: 0.36,
    ota: 0.22,
    travelAgent: 0.12,
    corporate: 0.16,
    gds: 0.14,
  },
};

const SEGMENT_ENVIRONMENT_SENSITIVITY: Record<
  SegmentId,
  {
    economy: number;
    stable_clear: number;
    rainy_spell: number;
    heatwave: number;
    cold_snap: number;
    expo: number;
    holiday_peak: number;
    concert: number;
    transport_disruption: number;
    public_health_alert: number;
  }
> = {
  business_transient: {
    economy: 1.15,
    stable_clear: 0.01,
    rainy_spell: -0.01,
    heatwave: -0.01,
    cold_snap: -0.02,
    expo: 0.06,
    holiday_peak: -0.04,
    concert: -0.01,
    transport_disruption: -0.06,
    public_health_alert: -0.14,
  },
  business_group: {
    economy: 1.22,
    stable_clear: 0.01,
    rainy_spell: -0.02,
    heatwave: -0.02,
    cold_snap: -0.03,
    expo: 0.16,
    holiday_peak: -0.08,
    concert: -0.02,
    transport_disruption: -0.08,
    public_health_alert: -0.18,
  },
  leisure_transient: {
    economy: 0.68,
    stable_clear: 0.04,
    rainy_spell: -0.06,
    heatwave: -0.03,
    cold_snap: -0.05,
    expo: -0.02,
    holiday_peak: 0.16,
    concert: 0.07,
    transport_disruption: -0.1,
    public_health_alert: -0.18,
  },
  leisure_group: {
    economy: 0.62,
    stable_clear: 0.03,
    rainy_spell: -0.05,
    heatwave: -0.02,
    cold_snap: -0.05,
    expo: -0.01,
    holiday_peak: 0.12,
    concert: 0.04,
    transport_disruption: -0.08,
    public_health_alert: -0.16,
  },
  government: {
    economy: 0.42,
    stable_clear: 0,
    rainy_spell: -0.01,
    heatwave: -0.01,
    cold_snap: -0.01,
    expo: 0.04,
    holiday_peak: -0.06,
    concert: -0.02,
    transport_disruption: -0.04,
    public_health_alert: -0.08,
  },
  online_ota: {
    economy: 0.72,
    stable_clear: 0.04,
    rainy_spell: -0.06,
    heatwave: -0.03,
    cold_snap: -0.05,
    expo: -0.03,
    holiday_peak: 0.15,
    concert: 0.09,
    transport_disruption: -0.08,
    public_health_alert: -0.2,
  },
  airline_crew: {
    economy: 0.22,
    stable_clear: 0,
    rainy_spell: 0.01,
    heatwave: 0,
    cold_snap: 0.01,
    expo: -0.01,
    holiday_peak: -0.01,
    concert: 0,
    transport_disruption: 0.05,
    public_health_alert: -0.06,
  },
  long_stay: {
    economy: 0.35,
    stable_clear: 0.01,
    rainy_spell: -0.01,
    heatwave: 0,
    cold_snap: 0,
    expo: 0.01,
    holiday_peak: -0.02,
    concert: -0.01,
    transport_disruption: 0.02,
    public_health_alert: -0.08,
  },
};

const SEGMENT_DIRECT_BOOKING_WEIGHT: Record<SegmentId, number> = {
  business_transient: 1,
  business_group: 1.12,
  leisure_transient: 0.62,
  leisure_group: 0.54,
  government: 0.96,
  online_ota: 0.28,
  airline_crew: 0.88,
  long_stay: 0.92,
};

const SEGMENT_FACILITIES_WEIGHT: Record<SegmentId, number> = {
  business_transient: 0.45,
  business_group: 1,
  leisure_transient: 0.32,
  leisure_group: 0.74,
  government: 0.66,
  online_ota: 0.18,
  airline_crew: 0.2,
  long_stay: 0.36,
};

type SegmentOperatingProfile = {
  fbSpendWeight: number;
  otherSpendWeight: number;
  serviceLoadWeight: number;
  yieldPriorityWeight: number;
};

const SEGMENT_OPERATING_PROFILES: Record<SegmentId, SegmentOperatingProfile> = {
  business_transient: {
    fbSpendWeight: 1.02,
    otherSpendWeight: 0.96,
    serviceLoadWeight: 1.04,
    yieldPriorityWeight: 1.04,
  },
  business_group: {
    fbSpendWeight: 1.64,
    otherSpendWeight: 1.1,
    serviceLoadWeight: 0.9,
    yieldPriorityWeight: 1.12,
  },
  leisure_transient: {
    fbSpendWeight: 1.08,
    otherSpendWeight: 0.92,
    serviceLoadWeight: 1.08,
    yieldPriorityWeight: 0.98,
  },
  leisure_group: {
    fbSpendWeight: 1.38,
    otherSpendWeight: 0.88,
    serviceLoadWeight: 0.92,
    yieldPriorityWeight: 1.01,
  },
  government: {
    fbSpendWeight: 0.84,
    otherSpendWeight: 0.82,
    serviceLoadWeight: 0.94,
    yieldPriorityWeight: 0.9,
  },
  online_ota: {
    fbSpendWeight: 0.92,
    otherSpendWeight: 0.8,
    serviceLoadWeight: 1.06,
    yieldPriorityWeight: 0.82,
  },
  airline_crew: {
    fbSpendWeight: 0.62,
    otherSpendWeight: 0.76,
    serviceLoadWeight: 0.8,
    yieldPriorityWeight: 0.72,
  },
  long_stay: {
    fbSpendWeight: 0.58,
    otherSpendWeight: 1.48,
    serviceLoadWeight: 0.62,
    yieldPriorityWeight: 0.88,
  },
};

export const SIMULATION_FORMULA_MANIFEST: FormulaManifestEntry[] = [
  {
    id: "market-demand",
    title: "市场需求生成",
    purpose: "根据轮次环境、季节系数与基础需求参数生成各细分市场的可争夺需求。",
    outputs: ["segment.totalDemand"],
    parameterKeys: [
      "totalMarketDemandBase",
      "demandPerHotelBase",
      "daysInMonth",
      "weatherEnergySensitivity",
    ],
    teacherHandoffReady: true,
  },
  {
    id: "appeal-scoring",
    title: "团队吸引力评分",
    purpose: "综合价格、营销、质量、渠道、ESG、品牌与可控随机扰动，为每个团队分配细分市场份额。",
    outputs: ["team.appeal", "team.segmentShare"],
    parameterKeys: [
      "competitionIntensity",
      "randomnessFactor",
      "otaBillboardFactor",
      "directBookingLift",
      "facilitiesUpsellFactor",
    ],
    teacherHandoffReady: true,
  },
  {
    id: "guest-experience",
    title: "顾客体验与品牌演化",
    purpose: "根据价格公平性、服务投入、品牌衰减与满意度，更新品牌、评分和 ESG 状态。",
    outputs: [
      "guestSatisfactionEnd",
      "brandReputationEnd",
      "onlineRatingEnd",
      "esgScoreEnd",
    ],
    parameterKeys: [
      "brandDecayRate",
      "conditionDecayRate",
      "serviceStrainThreshold",
      "laborCostSensitivity",
    ],
    teacherHandoffReady: true,
  },
  {
    id: "financial-outcome",
    title: "经营财务结果",
    purpose: "由客房收入、餐饮及其他收入、固定与变动成本、税费、资本开支推导利润与现金。",
    outputs: ["totalRevenue", "netProfit", "cashBalanceEnd"],
    parameterKeys: [
      "fbRevenueRatio",
      "otherRevenueRatio",
      "corporateTaxRate",
      "depreciationRate",
      "basePropertyTaxRate",
      "vatRate",
      "laborCostSensitivity",
      "weatherEnergySensitivity",
      "facilitiesUpsellFactor",
    ],
    teacherHandoffReady: true,
  },
  {
    id: "composite-ranking",
    title: "综合排名",
    purpose: "使用收入、利润、入住率、满意度和 ESG 组成当前版本的综合评分。",
    outputs: ["rankOverall", "overallScore"],
    parameterKeys: [],
    teacherHandoffReady: true,
  },
] as const;

const WEIGHTED_REFERENCE_PRICE = MARKET_SEGMENTS.reduce(
  (sum, segment) => sum + segment.defaultPrice * segment.baselineDemandShare,
  0
);

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function roundTo(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildStableNoise(seed: string) {
  let hash = 2166136261;

  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 0xffffffff;
}

function buildRandomnessMultiplier(seed: string, randomnessFactor: number) {
  if (randomnessFactor <= 0) {
    return 1;
  }

  const centeredNoise = buildStableNoise(seed) * 2 - 1;
  return clamp(1 + centeredNoise * randomnessFactor, 0.78, 1.22);
}

function resolveEnvironmentTags(round: Pick<SimulationInput["round"], "eventDescription">) {
  const parsed = parseEnvironmentDescription(round.eventDescription);

  return {
    weatherId:
      parsed.weatherLabel === "晴朗平稳"
        ? "stable_clear"
        : parsed.weatherLabel === "连续降雨"
          ? "rainy_spell"
          : parsed.weatherLabel === "高温炎热"
            ? "heatwave"
            : parsed.weatherLabel === "寒潮降温"
              ? "cold_snap"
              : null,
    eventId:
      parsed.eventLabel === "大型会展"
        ? "expo"
        : parsed.eventLabel === "假期客流高峰"
          ? "holiday_peak"
          : parsed.eventLabel === "演出/赛事"
            ? "concert"
            : parsed.eventLabel === "交通受阻"
              ? "transport_disruption"
              : parsed.eventLabel === "公共卫生预警"
                ? "public_health_alert"
                : null,
  } as const;
}

function calculateSegmentEnvironmentRawFactor(
  segmentId: SegmentId,
  input: Pick<SimulationInput["round"], "eventDescription" | "economyFactor">
) {
  const tags = resolveEnvironmentTags(input);
  const sensitivity = SEGMENT_ENVIRONMENT_SENSITIVITY[segmentId];
  const economyDelta = input.economyFactor - 1;
  let factor = 1 + economyDelta * sensitivity.economy;

  if (tags.weatherId) {
    factor += sensitivity[tags.weatherId];
  }

  if (tags.eventId) {
    factor += sensitivity[tags.eventId];
  }

  return clamp(factor, 0.72, 1.28);
}

export function getPriceForSegment(decision: Decision, segmentId: SegmentId) {
  return decision[SEGMENT_PRICE_FIELD_MAP[segmentId]];
}

export function getMarketingBudgetForSegment(
  decision: Decision,
  segmentId: SegmentId
) {
  return decision[SEGMENT_MARKETING_FIELD_MAP[segmentId]];
}

export function calculateWeightedAveragePrice(decision: Decision) {
  return roundTo(
    MARKET_SEGMENTS.reduce(
      (sum, segment) =>
        sum +
        getPriceForSegment(decision, segment.id as SegmentId) *
          segment.baselineDemandShare,
      0
    ),
    2
  );
}

export function sumChannelMix(decision: Decision) {
  return (
    decision.channelDirect +
    decision.channelOTA +
    decision.channelTravelAgent +
    decision.channelCorporate +
    decision.channelGDS
  );
}

export function sumMarketingAllocation(decision: Decision) {
  return (
    decision.mktBudgetBusinessTransient +
    decision.mktBudgetBusinessGroup +
    decision.mktBudgetLeisureTransient +
    decision.mktBudgetLeisureGroup +
    decision.mktBudgetGovernment +
    decision.mktBudgetOnlineOTA +
    decision.mktBudgetAirlineCrew +
    decision.mktBudgetLongStay
  );
}

export function calculateWeightedChannelCostRate(decision: Decision) {
  return roundTo(
    clamp(
      (decision.channelDirect / 100) * CHANNEL_COST_RATE.direct +
        (decision.channelOTA / 100) * CHANNEL_COST_RATE.ota +
        (decision.channelTravelAgent / 100) * CHANNEL_COST_RATE.travelAgent +
        (decision.channelCorporate / 100) * CHANNEL_COST_RATE.corporate +
        (decision.channelGDS / 100) * CHANNEL_COST_RATE.gds,
      0.015,
      0.16
    ),
    4
  );
}

export function getSegmentOperatingProfile(segmentId: SegmentId) {
  return SEGMENT_OPERATING_PROFILES[segmentId];
}

export function calculateTeamQualityIndex(hotelState: HotelState) {
  return clamp(
    average([
      hotelState.propertyCondition * 0.22,
      hotelState.furnitureCondition * 0.18,
      hotelState.technologyLevel * 0.18,
      hotelState.brandReputation * 0.14,
      hotelState.guestSatisfaction * 0.18,
      hotelState.onlineRating * 20 * 0.1,
    ]) / 14.5,
    0.5,
    1.25
  );
}

export function calculateChannelFit(decision: Decision, segmentId: SegmentId) {
  const weights = CHANNEL_FIT_WEIGHTS[segmentId];

  return (
    decision.channelDirect * weights.direct +
    decision.channelOTA * weights.ota +
    decision.channelTravelAgent * weights.travelAgent +
    decision.channelCorporate * weights.corporate +
    decision.channelGDS * weights.gds
  );
}

export function calculateGuestSatisfaction(
  decision: Decision,
  hotelState: HotelState,
  qualityIndex: number,
  occupancyRate: number
) {
  const averagePrice = calculateWeightedAveragePrice(decision);
  const priceFairness = clamp(
    Math.pow(WEIGHTED_REFERENCE_PRICE / Math.max(averagePrice, 1), 0.22),
    0.88,
    1.06
  );
  const serviceInvestment =
    (decision.opexFrontDesk +
      decision.opexHousekeeping +
      decision.opexFoodBeverage +
      decision.opexStaffTraining +
      decision.opexStaffWelfare) /
    82;
  const experienceBase =
    hotelState.propertyCondition * 0.26 +
    hotelState.furnitureCondition * 0.18 +
    hotelState.technologyLevel * 0.12 +
    hotelState.staffMorale * 0.16 +
    hotelState.staffTrainingLevel * 0.12 +
    hotelState.onlineRating * 6;
  const crowdingPenalty = clamp((occupancyRate - 0.78) / 0.18, 0, 1);

  return clamp(
    hotelState.guestSatisfaction * 0.54 +
      qualityIndex * 10 +
      experienceBase * 0.08 +
      serviceInvestment * 9 +
      priceFairness * 6 -
      crowdingPenalty * 12,
    0,
    100
  );
}

export function calculateBrandReputation(
  decision: Decision,
  hotelState: HotelState,
  guestSatisfactionEnd: number,
  parameters: SimParameters
) {
  const averagePrice = calculateWeightedAveragePrice(decision);
  const rateIntegrity = clamp(
    1 -
      Math.max(0, (WEIGHTED_REFERENCE_PRICE * 0.88 - averagePrice) / WEIGHTED_REFERENCE_PRICE),
    0.82,
    1.02
  );

  return clamp(
    hotelState.brandReputation * (1 - parameters.brandDecayRate) +
      decision.marketingTotal * 0.08 +
      guestSatisfactionEnd * 0.08 +
      hotelState.onlineRating * 2 +
      rateIntegrity * 6,
    0,
    100
  );
}

export function calculateEsgScore(decision: Decision, hotelState: HotelState) {
  const environmentalInvestment =
    decision.esgEnergyInvestment * 0.38 +
    decision.esgWasteManagement * 0.24 +
    decision.capexESGGreen * 0.38;
  const socialInvestment =
    decision.esgCommunityEngagement * 0.48 +
    decision.esgEmployeeDiversity * 0.52;

  return clamp(
    hotelState.esgScore * 0.9 +
      environmentalInvestment * 0.1 +
      socialInvestment * 0.05,
    0,
    100
  );
}

export function calculateOnlineRating(
  hotelState: HotelState,
  guestSatisfactionEnd: number,
  brandReputationEnd: number
) {
  return clamp(
    roundTo(
      hotelState.onlineRating * 0.74 +
        guestSatisfactionEnd / 100 +
        brandReputationEnd / 300,
      2
    ),
    1,
    5
  );
}

export function buildSegmentDemandMap(
  input: Pick<SimulationInput, "round" | "teams">,
  parameters: SimParameters
) {
  const teamCount = input.teams.length;
  const baseDemand =
    Math.max(
      parameters.totalMarketDemandBase,
      parameters.demandPerHotelBase * teamCount
    ) *
    input.round.seasonFactor *
    input.round.economyFactor *
    input.round.eventFactor;
  // Keep the class-wide demand scale stable, then redistribute demand across
  // segments according to the round's weather/event/economy profile. This
  // makes expo rounds tilt toward MICE while holiday rounds tilt toward
  // leisure without accidentally exploding total market size.
  const segmentEnvironmentFactors = MARKET_SEGMENTS.map((segment) => ({
    id: segment.id,
    factor: calculateSegmentEnvironmentRawFactor(
      segment.id as SegmentId,
      input.round
    ),
  }));
  const weightedEnvironmentMean =
    segmentEnvironmentFactors.reduce((sum, entry) => {
      const segment = MARKET_SEGMENTS.find((candidate) => candidate.id === entry.id);
      return sum + entry.factor * (segment?.baselineDemandShare ?? 0);
    }, 0) || 1;

  return MARKET_SEGMENTS.map((segment) => ({
    segment,
    totalDemand: roundTo(
      baseDemand *
        segment.baselineDemandShare *
        segment.seasonalPattern[(input.round.roundNumber - 1) % 12] *
        ((segmentEnvironmentFactors.find((entry) => entry.id === segment.id)?.factor ?? 1) /
          weightedEnvironmentMean),
      2
    ),
  }));
}

export function calculateTeamAppeal(input: {
  segment: MarketSegment;
  totalDemand: number;
  decision: Decision;
  hotelState: HotelState;
  teamId: string;
  roundNumber: number;
  parameters: SimParameters;
}) {
  const price = getPriceForSegment(input.decision, input.segment.id as SegmentId);
  const marketingBudget = getMarketingBudgetForSegment(
    input.decision,
    input.segment.id as SegmentId
  );
  const channelFit = calculateChannelFit(
    input.decision,
    input.segment.id as SegmentId
  );
  const qualityIndex = calculateTeamQualityIndex(input.hotelState);
  const boundedPrice = clamp(
    price,
    input.segment.priceFloor * 0.8,
    input.segment.priceCeiling * 1.12
  );
  const priceRatio = boundedPrice / Math.max(input.segment.defaultPrice, 1);
  const elasticityScore = clamp(
    Math.pow(priceRatio, input.segment.priceElasticity),
    0.72,
    1.24
  );
  const rateIntegrityScore = clamp(
    1 -
      Math.max(0, (input.segment.defaultPrice * 0.86 - boundedPrice) / input.segment.defaultPrice),
    0.82,
    1.02
  );
  const priceScore = clamp(elasticityScore * rateIntegrityScore, 0.7, 1.22);
  const marketingShare = marketingBudget / Math.max(input.decision.marketingTotal, 1);
  const marketingAllocationFit = clamp(
    1 -
      Math.abs(marketingShare - input.segment.baselineDemandShare) /
        Math.max(input.segment.baselineDemandShare, 0.08) *
        0.24,
    0.72,
    1.06
  );
  const marketingIntensity = clamp(
    0.84 +
      (Math.log1p(marketingBudget) / Math.log1p(80)) *
        0.18 *
        input.segment.marketingSensitivity +
      (Math.log1p(input.decision.marketingTotal) / Math.log1p(160)) * 0.08,
    0.78,
    1.18
  );
  const marketingScore = clamp(
    marketingAllocationFit * marketingIntensity,
    0.72,
    1.2
  );
  const qualityScore = clamp(
    0.8 + (qualityIndex - 0.5) * input.segment.qualitySensitivity * 0.72,
    0.72,
    1.22
  );
  const channelScore = clamp(
    0.82 + (channelFit / 100) * 0.58,
    0.72,
    1.18
  );
  // Direct/corporate capability and facilities readiness are modeled as mild
  // multipliers so they improve quality demand capture without overpowering
  // core pricing, marketing, and brand dynamics.
  const directCapabilityBase =
    (input.decision.channelDirect +
      input.decision.channelCorporate +
      input.decision.channelGDS) /
    100;
  const directCapability = clamp(
    0.92 +
      directCapabilityBase *
        SEGMENT_DIRECT_BOOKING_WEIGHT[input.segment.id as SegmentId] *
        input.parameters.directBookingLift *
        (0.6 +
          input.hotelState.brandReputation / 250 +
          input.hotelState.technologyLevel / 250),
    0.9,
    1.14
  );
  const otaBillboardScore = clamp(
    1 +
      (input.decision.channelOTA / 100) *
        input.parameters.otaBillboardFactor *
        (0.5 +
          input.hotelState.brandReputation / 250 +
          input.hotelState.onlineRating / 10),
    0.98,
    1.06
  );
  const facilitiesScore = clamp(
    0.94 +
      SEGMENT_FACILITIES_WEIGHT[input.segment.id as SegmentId] *
        input.parameters.facilitiesUpsellFactor *
        (input.decision.capexFacilities / 20) +
      SEGMENT_FACILITIES_WEIGHT[input.segment.id as SegmentId] *
        0.05 *
        (input.hotelState.technologyLevel / 100),
    0.92,
    1.18
  );
  const serviceReputationScore = clamp(
    0.94 +
      (input.hotelState.staffTrainingLevel / 100) * 0.06 +
      (input.hotelState.staffMorale / 100) * 0.05 +
      (input.decision.opexFrontDesk + input.decision.opexHousekeeping) / 300,
    0.92,
    1.12
  );
  // Cornell hospitality work suggests sustainability effort alone does not
  // reliably lift topline revenue, so ESG only provides a mild demand effect
  // here and mainly pays back through costs, brand, and resilience elsewhere.
  const esgScore = clamp(
    0.98 +
      (input.hotelState.esgScore / 100) * 0.025 +
      ((input.decision.esgCommunityEngagement + input.decision.esgEmployeeDiversity) /
        200) *
        0.015,
    0.96,
    1.05
  );
  const brandScore = clamp(
    0.84 +
      (input.hotelState.brandReputation / 100) * 0.16 +
      (input.hotelState.onlineRating / 5) * 0.1,
    0.76,
    1.18
  );
  const randomnessMultiplier = buildRandomnessMultiplier(
    `appeal:${input.teamId}:${input.segment.id}:${input.roundNumber}`,
    input.parameters.randomnessFactor
  );

  return (
    priceScore *
    marketingScore *
    qualityScore *
    channelScore *
    directCapability *
    otaBillboardScore *
    facilitiesScore *
    serviceReputationScore *
    esgScore *
    brandScore *
    randomnessMultiplier *
    Math.max(input.totalDemand, 1)
  );
}

export function calculateOverallScore(input: {
  totalRevenue: number;
  netProfit: number;
  occupancyRate: number;
  esgScoreEnd: number;
  guestSatisfactionEnd: number;
}) {
  return (
    input.totalRevenue * 0.32 +
    input.netProfit * 0.42 +
    input.occupancyRate * 1_000_000 +
    input.esgScoreEnd * 8_000 +
    input.guestSatisfactionEnd * 4_000
  );
}
