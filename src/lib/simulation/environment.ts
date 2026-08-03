import { MARKET_SEGMENTS, ROUND_MONTH_MAP } from "@/lib/constants";
import { clamp, roundTo } from "@/lib/simulation/formulas";

export type EnvironmentWeatherId =
  | "stable_clear"
  | "rainy_spell"
  | "heatwave"
  | "cold_snap";

export type EnvironmentEconomyId =
  | "cooling"
  | "steady"
  | "growing"
  | "strong";

export type EnvironmentEventId =
  | "none"
  | "expo"
  | "holiday_peak"
  | "concert"
  | "transport_disruption"
  | "public_health_alert";

export type DemandOutlook = "strong" | "balanced" | "soft";

type EnvironmentPresetOption<Id extends string> = {
  id: Id;
  label: string;
  factor: number;
  description: string;
  monthWeights: readonly number[];
};

type SeasonProfile = {
  label: string;
  note: string;
};

type SerializedEnvironmentParts = {
  seasonLabel: string;
  weatherLabel: string;
  economyLabel: string;
  eventLabel: string;
  note: string;
};

type ParsedEnvironmentParts = {
  seasonLabel: string | null;
  weatherLabel: string | null;
  economyLabel: string | null;
  eventLabel: string | null;
  note: string | null;
};

export type RoundEnvironmentRecommendation = {
  roundNumber: number;
  monthIndex: number;
  monthLabel: string;
  seasonLabel: string;
  seasonFactor: number;
  economyFactor: number;
  eventFactor: number;
  totalDemandMultiplier: number;
  weatherId: EnvironmentWeatherId | null;
  weatherLabel: string;
  economyId: EnvironmentEconomyId | null;
  economyLabel: string;
  eventId: EnvironmentEventId | null;
  eventLabel: string;
  eventDescription: string;
  randomSeed: string | null;
  demandOutlook: DemandOutlook;
  suggestionReason: string;
  pricingHint: string;
  marketingHint: string;
  operationsHint: string;
  financeHint: string;
};

export const ENVIRONMENT_FACTOR_HINTS = {
  seasonFactor: "建议常用范围 0.82-1.18，主要反映月度季节性强弱。",
  economyFactor: "建议常用范围 0.93-1.10，主要反映景气度与企业差旅活跃度。",
  eventFactor: "建议常用范围 0.85-1.18，主要反映天气与城市事件的短期冲击。",
} as const;

const WEATHER_OPTIONS: readonly EnvironmentPresetOption<EnvironmentWeatherId>[] = [
  {
    id: "stable_clear",
    label: "晴朗平稳",
    factor: 1.02,
    description: "交通与本地活动运行平稳，需求释放更顺畅。",
    monthWeights: [1.3, 1.15, 1.2, 1.2, 1.15, 1.05, 0.85, 0.85, 1, 1.1, 1.15, 1.2],
  },
  {
    id: "rainy_spell",
    label: "连续降雨",
    factor: 0.95,
    description: "短途休闲出行受影响，但商旅刚需仍有一定支撑。",
    monthWeights: [0.65, 0.7, 0.85, 1.05, 1.2, 1.15, 1.2, 1.1, 0.95, 0.85, 0.75, 0.7],
  },
  {
    id: "heatwave",
    label: "高温炎热",
    factor: 0.97,
    description: "高温天气提升服务压力，旺季休闲需求结构会发生偏移。",
    monthWeights: [0.5, 0.45, 0.5, 0.7, 0.95, 1.25, 1.35, 1.35, 0.95, 0.7, 0.55, 0.45],
  },
  {
    id: "cold_snap",
    label: "寒潮降温",
    factor: 0.94,
    description: "寒潮降低临时出行意愿，也会抬升能源和运营压力。",
    monthWeights: [1.25, 1.2, 0.95, 0.65, 0.45, 0.4, 0.4, 0.45, 0.6, 0.85, 1.05, 1.2],
  },
] as const;

const ECONOMY_OPTIONS: readonly EnvironmentPresetOption<EnvironmentEconomyId>[] = [
  {
    id: "cooling",
    label: "需求偏冷",
    factor: 0.95,
    description: "企业差旅与高端消费更谨慎，价格竞争会更明显。",
    monthWeights: [0.9, 0.95, 0.95, 1, 1, 1, 1, 1, 1.05, 1.05, 1, 0.95],
  },
  {
    id: "steady",
    label: "平稳运行",
    factor: 1,
    description: "市场情绪中性，适合用作课堂或比赛的基准环境。",
    monthWeights: [1.3, 1.25, 1.2, 1.2, 1.15, 1.1, 1.05, 1.05, 1.1, 1.15, 1.2, 1.25],
  },
  {
    id: "growing",
    label: "温和增长",
    factor: 1.05,
    description: "商旅与会展需求有所抬升，优质策略更容易拉开差距。",
    monthWeights: [0.95, 0.95, 1.05, 1.1, 1.1, 1.05, 1, 1, 1.05, 1.15, 1.1, 1],
  },
  {
    id: "strong",
    label: "显著走强",
    factor: 1.09,
    description: "高景气会放大运营表现差异，但也更考验定价纪律。",
    monthWeights: [0.55, 0.6, 0.75, 0.9, 0.95, 0.95, 0.9, 0.9, 0.85, 0.85, 0.75, 0.65],
  },
] as const;

const EVENT_OPTIONS: readonly EnvironmentPresetOption<EnvironmentEventId>[] = [
  {
    id: "none",
    label: "无额外事件",
    factor: 1,
    description: "市场主要按季节规律运行，适合作为默认参考场景。",
    monthWeights: [1.2, 1.15, 1.1, 1.05, 1, 1, 0.95, 0.95, 1, 1.05, 1.1, 1.15],
  },
  {
    id: "expo",
    label: "大型会展",
    factor: 1.08,
    description: "商务团队、协议客户与会议需求通常同步走强。",
    monthWeights: [0.55, 0.65, 0.95, 1.2, 1.25, 1.1, 0.7, 0.7, 1.05, 1.2, 1.05, 0.65],
  },
  {
    id: "holiday_peak",
    label: "假期客流高峰",
    factor: 1.12,
    description: "休闲散客与 OTA 流量明显上扬，入住率容易快速冲高。",
    monthWeights: [0.95, 1.25, 0.85, 0.85, 1, 1.05, 1.35, 1.35, 1, 1.25, 0.9, 1.1],
  },
  {
    id: "concert",
    label: "演出/赛事",
    factor: 1.06,
    description: "短时流量集中释放，适合检验房量控制与价格弹性。",
    monthWeights: [0.7, 0.75, 0.9, 1.05, 1.1, 1.1, 1.05, 1.05, 1, 1.05, 0.9, 0.8],
  },
  {
    id: "transport_disruption",
    label: "交通受阻",
    factor: 0.92,
    description: "到达受阻会直接压制预订与临时客流，现金策略更重要。",
    monthWeights: [0.7, 0.75, 0.8, 0.9, 0.95, 1, 1.05, 1.05, 1, 0.95, 0.8, 0.75],
  },
  {
    id: "public_health_alert",
    label: "公共卫生预警",
    factor: 0.86,
    description: "需求承压明显，更适合用于压力测试或训练赛。",
    monthWeights: [0.3, 0.35, 0.4, 0.45, 0.45, 0.45, 0.4, 0.4, 0.45, 0.45, 0.4, 0.35],
  },
] as const;

const SEASON_PROFILES: readonly SeasonProfile[] = [
  {
    label: "冬季恢复期",
    note: "淡季客流偏谨慎，适合检验现金安全与成本控制。",
  },
  {
    label: "冬季恢复期",
    note: "春节与返工错位并存，需求波动较明显。",
  },
  {
    label: "春季会展期",
    note: "春季会展与商务需求逐步回暖，团队市场开始活跃。",
  },
  {
    label: "春季会展期",
    note: "商务活动与会议需求通常继续走强。",
  },
  {
    label: "春末过渡期",
    note: "商旅与休闲需求开始并行，适合做结构性定价。",
  },
  {
    label: "暑期预热期",
    note: "休闲需求抬头，但商务需求可能略有降温。",
  },
  {
    label: "暑期旅游旺季",
    note: "休闲客流强劲，入住压力和服务压力同步上升。",
  },
  {
    label: "暑期旅游旺季",
    note: "旺季房量紧张，更适合拉高 ADR 而不是粗暴压价。",
  },
  {
    label: "秋季商旅回流期",
    note: "商旅和团队活动回暖，是比较均衡的一段运营窗口。",
  },
  {
    label: "秋季商旅回流期",
    note: "会展与协议客户恢复，适合检验渠道与团队承接能力。",
  },
  {
    label: "年末冲刺期",
    note: "预算消化与年会活动增加，结构性需求更集中。",
  },
  {
    label: "年末收官期",
    note: "年末活动与节庆需求并存，适合考察收益管理纪律。",
  },
] as const;

const WEATHER_BY_LABEL = Object.fromEntries(
  WEATHER_OPTIONS.map((option) => [option.label, option.id])
) as Record<string, EnvironmentWeatherId>;

const ECONOMY_BY_LABEL = Object.fromEntries(
  ECONOMY_OPTIONS.map((option) => [option.label, option.id])
) as Record<string, EnvironmentEconomyId>;

const EVENT_BY_LABEL = Object.fromEntries(
  EVENT_OPTIONS.map((option) => [option.label, option.id])
) as Record<string, EnvironmentEventId>;

function getMonthIndex(roundNumber: number) {
  return ((roundNumber - 1) % 12 + 12) % 12;
}

function createSeededRandom(seed: string) {
  let state = 2166136261;

  for (const character of seed) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state = Math.imul(state ^ (state >>> 15), 2246822519);
    state = Math.imul(state ^ (state >>> 13), 3266489917);
    state ^= state >>> 16;
    return (state >>> 0) / 0xffffffff;
  };
}

function pickWeightedOption<Id extends string>(
  options: readonly EnvironmentPresetOption<Id>[],
  monthIndex: number,
  random: () => number
) {
  const totalWeight = options.reduce(
    (sum, option) => sum + option.monthWeights[monthIndex],
    0
  );

  let cursor = random() * totalWeight;

  for (const option of options) {
    cursor -= option.monthWeights[monthIndex];
    if (cursor <= 0) {
      return option;
    }
  }

  return options[options.length - 1];
}

function getWeatherOption(weatherId: EnvironmentWeatherId) {
  return WEATHER_OPTIONS.find((option) => option.id === weatherId) ?? WEATHER_OPTIONS[0];
}

function getEconomyOption(economyId: EnvironmentEconomyId) {
  return ECONOMY_OPTIONS.find((option) => option.id === economyId) ?? ECONOMY_OPTIONS[1];
}

function getEventOption(eventId: EnvironmentEventId) {
  return EVENT_OPTIONS.find((option) => option.id === eventId) ?? EVENT_OPTIONS[0];
}

function getSeasonFactor(roundNumber: number) {
  const monthIndex = getMonthIndex(roundNumber);

  return roundTo(
    MARKET_SEGMENTS.reduce(
      (sum, segment) => sum + segment.seasonalPattern[monthIndex],
      0
    ) / MARKET_SEGMENTS.length,
    3
  );
}

function getSeasonProfile(roundNumber: number) {
  return SEASON_PROFILES[getMonthIndex(roundNumber)];
}

function serializeEnvironmentDescription(parts: SerializedEnvironmentParts) {
  const description = [
    `环境摘要：${parts.seasonLabel}`,
    `天气：${parts.weatherLabel}`,
    `景气：${parts.economyLabel}`,
    `事件：${parts.eventLabel}`,
    `提示：${parts.note}`,
  ].join("；");

  return description.length <= 500 ? description : `${description.slice(0, 497)}...`;
}

function extractTaggedValue(description: string, label: string) {
  const matched = description.match(new RegExp(`${label}：([^；]+)`));
  return matched?.[1]?.trim() ?? null;
}

export function parseEnvironmentDescription(
  description: string | null | undefined
): ParsedEnvironmentParts {
  if (!description) {
    return {
      seasonLabel: null,
      weatherLabel: null,
      economyLabel: null,
      eventLabel: null,
      note: null,
    };
  }

  return {
    seasonLabel: extractTaggedValue(description, "环境摘要"),
    weatherLabel: extractTaggedValue(description, "天气"),
    economyLabel: extractTaggedValue(description, "景气"),
    eventLabel: extractTaggedValue(description, "事件"),
    note: extractTaggedValue(description, "提示"),
  };
}

function resolveEconomyIdFromFactor(factor: number): EnvironmentEconomyId {
  if (factor <= 0.97) {
    return "cooling";
  }

  if (factor >= 1.07) {
    return "strong";
  }

  if (factor >= 1.03) {
    return "growing";
  }

  return "steady";
}

function resolveDemandOutlook(multiplier: number): DemandOutlook {
  if (multiplier >= 1.08) {
    return "strong";
  }

  if (multiplier <= 0.94) {
    return "soft";
  }

  return "balanced";
}

function buildPricingHint(outlook: DemandOutlook, eventId: EnvironmentEventId | null) {
  if (outlook === "strong") {
    return eventId === "holiday_peak"
      ? "需求偏旺，建议优先保价提 ADR，避免在 OTA 上过度促销。"
      : "需求走强，建议稳价或小幅提价，尽量把房量留给高价值客群。";
  }

  if (outlook === "soft") {
    return "需求偏弱，建议谨慎降价，并把折扣集中给高转化渠道和细分客群。";
  }

  return "环境相对平衡，可通过分客群差异化定价来拉开团队表现。";
}

function buildMarketingHint(
  eventId: EnvironmentEventId | null,
  weatherId: EnvironmentWeatherId | null
) {
  if (eventId === "expo") {
    return "建议把预算向商务散客、商务团队和协议客户倾斜，强化会展承接。";
  }

  if (eventId === "holiday_peak" || weatherId === "stable_clear") {
    return "可以适度增加休闲散客、OTA 和直销投放，承接旺季休闲需求。";
  }

  if (eventId === "transport_disruption" || weatherId === "rainy_spell") {
    return "建议收缩泛流量投放，把预算优先给协议客户、长住和更稳定的客源。";
  }

  return "建议保持营销分配与目标客群一致，避免预算分散导致边际效果变弱。";
}

function buildOperationsHint(
  weatherId: EnvironmentWeatherId | null,
  outlook: DemandOutlook
) {
  if (weatherId === "heatwave") {
    return "高温环境下应预留前厅、客房服务和能源水电预算，避免服务掉链子。";
  }

  if (weatherId === "cold_snap") {
    return "寒潮下能源与设备维护压力更高，建议提前做好房务与能耗准备。";
  }

  if (outlook === "strong") {
    return "客流高峰期应关注满房压力，避免入住率冲高后满意度反向下滑。";
  }

  return "运营节奏相对可控，可通过培训和维护投入稳住满意度与品牌。";
}

function buildFinanceHint(
  economyId: EnvironmentEconomyId | null,
  eventId: EnvironmentEventId | null
) {
  if (economyId === "cooling" || eventId === "public_health_alert") {
    return "建议更看重现金安全与债务节奏，不宜激进扩张。";
  }

  if (economyId === "strong") {
    return "高景气环境里，优质策略会更容易放大收益，但也要控制债务杠杆。";
  }

  return "建议在盈利与现金之间保持均衡，不要只追求单轮收入排名。";
}

export function buildEnvironmentSeed(input: {
  roundNumber: number;
  classId?: string | null;
  source?: string;
}) {
  const source = input.source ?? "manual";
  return `env:${input.classId ?? "class"}:${input.roundNumber}:${source}`;
}

export function buildRecommendedRoundEnvironment(input: {
  roundNumber: number;
  weatherId?: EnvironmentWeatherId;
  economyId?: EnvironmentEconomyId;
  eventId?: EnvironmentEventId;
  customNote?: string | null;
  randomSeed?: string | null;
}): RoundEnvironmentRecommendation {
  const monthIndex = getMonthIndex(input.roundNumber);
  const monthLabel = ROUND_MONTH_MAP[monthIndex];
  const seasonProfile = getSeasonProfile(input.roundNumber);
  const weather = getWeatherOption(input.weatherId ?? "stable_clear");
  const economy = getEconomyOption(input.economyId ?? "steady");
  const event = getEventOption(input.eventId ?? "none");
  const seasonFactor = getSeasonFactor(input.roundNumber);
  const eventFactor = roundTo(
    clamp(weather.factor * event.factor, 0.82, 1.18),
    3
  );
  const totalDemandMultiplier = roundTo(
    seasonFactor * economy.factor * eventFactor,
    3
  );
  const demandOutlook = resolveDemandOutlook(totalDemandMultiplier);
  const note =
    input.customNote?.trim() ||
    `${seasonProfile.note}${weather.description}${event.description}${economy.description}`;
  const eventDescription = serializeEnvironmentDescription({
    seasonLabel: seasonProfile.label,
    weatherLabel: weather.label,
    economyLabel: economy.label,
    eventLabel: event.label,
    note,
  });

  return {
    roundNumber: input.roundNumber,
    monthIndex,
    monthLabel,
    seasonLabel: seasonProfile.label,
    seasonFactor,
    economyFactor: economy.factor,
    eventFactor,
    totalDemandMultiplier,
    weatherId: weather.id,
    weatherLabel: weather.label,
    economyId: economy.id,
    economyLabel: economy.label,
    eventId: event.id,
    eventLabel: event.label,
    eventDescription,
    randomSeed: input.randomSeed ?? null,
    demandOutlook,
    suggestionReason: note,
    pricingHint: buildPricingHint(demandOutlook, event.id),
    marketingHint: buildMarketingHint(event.id, weather.id),
    operationsHint: buildOperationsHint(weather.id, demandOutlook),
    financeHint: buildFinanceHint(economy.id, event.id),
  };
}

export function buildRandomRoundEnvironment(input: {
  roundNumber: number;
  classId?: string | null;
  seed?: string;
}) {
  const seed =
    input.seed ??
    buildEnvironmentSeed({
      roundNumber: input.roundNumber,
      classId: input.classId,
      source: String(Date.now()),
    });
  const monthIndex = getMonthIndex(input.roundNumber);
  const random = createSeededRandom(seed);
  const weather = pickWeightedOption(WEATHER_OPTIONS, monthIndex, random);
  const economy = pickWeightedOption(ECONOMY_OPTIONS, monthIndex, random);
  const event = pickWeightedOption(EVENT_OPTIONS, monthIndex, random);

  return buildRecommendedRoundEnvironment({
    roundNumber: input.roundNumber,
    weatherId: weather.id,
    economyId: economy.id,
    eventId: event.id,
    randomSeed: seed,
  });
}

export function describeRoundEnvironment(input: {
  roundNumber: number;
  seasonFactor: number;
  economyFactor: number;
  eventFactor: number;
  eventDescription?: string | null;
  randomSeed?: string | null;
}): RoundEnvironmentRecommendation {
  const parsed = parseEnvironmentDescription(input.eventDescription);
  const monthIndex = getMonthIndex(input.roundNumber);
  const monthLabel = ROUND_MONTH_MAP[monthIndex];
  const seasonProfile = getSeasonProfile(input.roundNumber);
  const economyId = parsed.economyLabel
    ? ECONOMY_BY_LABEL[parsed.economyLabel] ?? resolveEconomyIdFromFactor(input.economyFactor)
    : resolveEconomyIdFromFactor(input.economyFactor);
  const weatherId = parsed.weatherLabel
    ? WEATHER_BY_LABEL[parsed.weatherLabel] ?? null
    : null;
  const eventId = parsed.eventLabel ? EVENT_BY_LABEL[parsed.eventLabel] ?? null : null;
  const economy = getEconomyOption(economyId);
  const weather = weatherId ? getWeatherOption(weatherId) : null;
  const event = eventId ? getEventOption(eventId) : null;
  const totalDemandMultiplier = roundTo(
    input.seasonFactor * input.economyFactor * input.eventFactor,
    3
  );
  const demandOutlook = resolveDemandOutlook(totalDemandMultiplier);
  const suggestionReason =
    parsed.note?.trim() ||
    input.eventDescription?.trim() ||
    `${seasonProfile.note}当前环境以手动配置为准。`;

  return {
    roundNumber: input.roundNumber,
    monthIndex,
    monthLabel,
    seasonLabel: parsed.seasonLabel ?? seasonProfile.label,
    seasonFactor: roundTo(input.seasonFactor, 3),
    economyFactor: roundTo(input.economyFactor, 3),
    eventFactor: roundTo(input.eventFactor, 3),
    totalDemandMultiplier,
    weatherId,
    weatherLabel:
      parsed.weatherLabel ?? weather?.label ?? (input.eventDescription ? "自定义环境" : "未标注"),
    economyId,
    economyLabel: parsed.economyLabel ?? economy.label,
    eventId,
    eventLabel:
      parsed.eventLabel ?? event?.label ?? (input.eventDescription ? "自定义说明" : "无额外事件"),
    eventDescription:
      input.eventDescription?.trim() ||
      serializeEnvironmentDescription({
        seasonLabel: seasonProfile.label,
        weatherLabel: weather?.label ?? "未标注",
        economyLabel: economy.label,
        eventLabel: event?.label ?? "无额外事件",
        note: suggestionReason,
      }),
    randomSeed: input.randomSeed ?? null,
    demandOutlook,
    suggestionReason,
    pricingHint: buildPricingHint(demandOutlook, eventId),
    marketingHint: buildMarketingHint(eventId, weatherId),
    operationsHint: buildOperationsHint(weatherId, demandOutlook),
    financeHint: buildFinanceHint(economyId, eventId),
  };
}

export const ENVIRONMENT_PRESET_OPTIONS = {
  weather: WEATHER_OPTIONS.map((option) => ({
    id: option.id,
    label: option.label,
    description: option.description,
  })),
  economy: ECONOMY_OPTIONS.map((option) => ({
    id: option.id,
    label: option.label,
    description: option.description,
  })),
  event: EVENT_OPTIONS.map((option) => ({
    id: option.id,
    label: option.label,
    description: option.description,
  })),
} as const;
