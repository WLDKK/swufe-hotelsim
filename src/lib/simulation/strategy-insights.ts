import {
  DEFAULT_DECISION_FORM_VALUES,
  type DecisionFormValues,
} from "@/lib/decisions/form";

type SupportedLocale = "zh-CN" | "en-US";

type StrategySignal = {
  id: "revenue" | "service" | "brand" | "risk";
  label: string;
  score: number;
  detail: string;
};

type StrategyWarning = {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
};

type StrategySuggestion = {
  id: string;
  title: string;
  detail: string;
};

type StrategyFocusSegment = {
  id: string;
  label: string;
  allocation: number;
};

export type StrategyAdvisorSnapshot = {
  archetype: {
    id: "premium_yield" | "demand_grab" | "brand_rebuild" | "cash_defense" | "balanced";
    label: string;
    summary: string;
  };
  readinessScore: number;
  readinessLabel: string;
  headline: string;
  focusSegments: StrategyFocusSegment[];
  signals: StrategySignal[];
  warnings: StrategyWarning[];
  suggestions: StrategySuggestion[];
};

type HotelStateSummary = {
  cashBalance: number;
  totalDebt: number;
  brandReputation: number;
  guestSatisfaction: number;
  esgScore: number;
} | null;

const SEGMENT_LABELS = {
  business_transient: { zh: "商务散客", en: "Business transient" },
  business_group: { zh: "商务团队", en: "Business group" },
  leisure_transient: { zh: "休闲散客", en: "Leisure transient" },
  leisure_group: { zh: "休闲团队", en: "Leisure group" },
  government: { zh: "政府客户", en: "Government" },
  online_ota: { zh: "OTA 线上", en: "OTA online" },
  airline_crew: { zh: "航司机组", en: "Airline crew" },
  long_stay: { zh: "长住客户", en: "Long stay" },
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function ratio(value: number, baseline: number) {
  return baseline > 0 ? value / baseline : 0;
}

function t(locale: SupportedLocale, zh: string, en: string) {
  return locale === "zh-CN" ? zh : en;
}

function getFocusSegments(
  values: DecisionFormValues,
  locale: SupportedLocale
): StrategyFocusSegment[] {
  const entries: Array<{
    id: keyof typeof SEGMENT_LABELS;
    allocation: number;
  }> = [
    {
      id: "business_transient",
      allocation: values.mktBudgetBusinessTransient,
    },
    {
      id: "business_group",
      allocation: values.mktBudgetBusinessGroup,
    },
    {
      id: "leisure_transient",
      allocation: values.mktBudgetLeisureTransient,
    },
    {
      id: "leisure_group",
      allocation: values.mktBudgetLeisureGroup,
    },
    {
      id: "government",
      allocation: values.mktBudgetGovernment,
    },
    {
      id: "online_ota",
      allocation: values.mktBudgetOnlineOTA,
    },
    {
      id: "airline_crew",
      allocation: values.mktBudgetAirlineCrew,
    },
    {
      id: "long_stay",
      allocation: values.mktBudgetLongStay,
    },
  ];

  return entries
    .sort((left, right) => right.allocation - left.allocation)
    .slice(0, 3)
    .map((entry) => ({
      id: entry.id,
      allocation: entry.allocation,
      label:
        locale === "zh-CN"
          ? SEGMENT_LABELS[entry.id].zh
          : SEGMENT_LABELS[entry.id].en,
    }));
}

export function analyzeDecisionStrategy(input: {
  values: DecisionFormValues;
  hotelState?: HotelStateSummary;
  locale?: SupportedLocale;
}): StrategyAdvisorSnapshot {
  const locale = input.locale ?? "zh-CN";
  const values = input.values;
  const hotelState = input.hotelState ?? null;
  const baseline = DEFAULT_DECISION_FORM_VALUES;

  const averagePrice = average([
    values.priceBusinessTransient,
    values.priceBusinessGroup,
    values.priceLeisureTransient,
    values.priceLeisureGroup,
    values.priceGovernment,
    values.priceOnlineOTA,
    values.priceAirlineCrew,
    values.priceLongStay,
  ]);
  const baselineAveragePrice = average([
    baseline.priceBusinessTransient,
    baseline.priceBusinessGroup,
    baseline.priceLeisureTransient,
    baseline.priceLeisureGroup,
    baseline.priceGovernment,
    baseline.priceOnlineOTA,
    baseline.priceAirlineCrew,
    baseline.priceLongStay,
  ]);

  const marketingAllocated =
    values.mktBudgetBusinessTransient +
    values.mktBudgetBusinessGroup +
    values.mktBudgetLeisureTransient +
    values.mktBudgetLeisureGroup +
    values.mktBudgetGovernment +
    values.mktBudgetOnlineOTA +
    values.mktBudgetAirlineCrew +
    values.mktBudgetLongStay;
  const channelTotal =
    values.channelDirect +
    values.channelOTA +
    values.channelTravelAgent +
    values.channelCorporate +
    values.channelGDS;
  const directMix =
    (values.channelDirect + values.channelCorporate + values.channelGDS) /
    Math.max(channelTotal, 1);
  const otaMix = values.channelOTA / Math.max(channelTotal, 1);
  const serviceInvestment =
    values.opexFrontDesk +
    values.opexHousekeeping +
    values.opexStaffTraining +
    values.opexStaffWelfare +
    values.opexRoomsMaintenance;
  const totalCapex =
    values.capexRenovation +
    values.capexFurniture +
    values.capexTechnology +
    values.capexFacilities +
    values.capexESGGreen;
  const esgIntensity =
    average([
      values.esgEnergyInvestment,
      values.esgWasteManagement,
      values.esgCommunityEngagement,
      values.esgEmployeeDiversity,
    ]) / 60;
  const financingPressure =
    (values.newLoanAmount * 1.2 + totalCapex * 0.85 - values.loanRepayment * 0.8) /
    40;
  const marketingGap = Math.abs(values.marketingTotal - marketingAllocated);
  const channelGap = Math.abs(100 - channelTotal);
  const pricePremium = ratio(averagePrice, baselineAveragePrice) - 1;
  const serviceCoverage = ratio(serviceInvestment, 73);
  const brandBase = average([
    hotelState?.brandReputation ?? 55,
    hotelState?.guestSatisfaction ?? 72,
    hotelState?.esgScore ?? 55,
  ]);
  const businessBias =
    (values.mktBudgetBusinessTransient + values.mktBudgetBusinessGroup) /
    Math.max(values.marketingTotal, 1);
  const leisureBias =
    (values.mktBudgetLeisureTransient +
      values.mktBudgetLeisureGroup +
      values.mktBudgetOnlineOTA) /
    Math.max(values.marketingTotal, 1);

  const signals: StrategySignal[] = [
    {
      id: "revenue",
      label: t(locale, "收益进攻性", "Revenue ambition"),
      score: clamp(
        50 +
          pricePremium * 220 +
          ratio(values.marketingTotal, baseline.marketingTotal) * 16 +
          directMix * 18 +
          values.capexFacilities * 1.6,
        0,
        100
      ),
      detail: t(
        locale,
        "由价格、营销和高收益渠道倾向共同决定，数值越高越偏向拉收入和 ADR。",
        "Driven by pricing, marketing, and high-yield channel exposure."
      ),
    },
    {
      id: "service",
      label: t(locale, "服务韧性", "Service resilience"),
      score: clamp(
        34 +
          serviceCoverage * 28 +
          values.opexIT * 1.2 +
          values.capexTechnology * 1.6 +
          values.opexUtilities * 0.6,
        0,
        100
      ),
      detail: t(
        locale,
        "主要反映前厅、客房、培训和技术支持是否足以兑现你的价格与需求目标。",
        "Shows whether operations can support the demand you are chasing."
      ),
    },
    {
      id: "brand",
      label: t(locale, "品牌蓄能", "Brand momentum"),
      score: clamp(
        24 +
          brandBase * 0.28 +
          directMix * 20 +
          esgIntensity * 18 +
          values.capexFacilities * 1.3 +
          values.capexTechnology * 1.1,
        0,
        100
      ),
      detail: t(
        locale,
        "体现直连能力、品牌资产、ESG 和设施投入的中长期积累效果。",
        "Captures long-term lift from brand, direct mix, ESG, and assets."
      ),
    },
    {
      id: "risk",
      label: t(locale, "财务风险", "Financial risk"),
      score: clamp(
        18 +
          financingPressure * 22 +
          marketingGap * 3 +
          channelGap * 2.4 +
          Math.max(0, otaMix - 0.45) * 46 +
          Math.max(0, pricePremium) * 26 -
          Math.max(0, values.loanRepayment - values.newLoanAmount) * 1.4,
        0,
        100
      ),
      detail: t(
        locale,
        "越高表示越依赖融资、渠道或激进定价来完成目标，需要更强执行力。",
        "Higher means the plan leans harder on leverage, pricing, or channels."
      ),
    },
  ];

  const warnings: StrategyWarning[] = [];

  if (marketingGap > 3) {
    warnings.push({
      id: "marketing-gap",
      severity: marketingGap > 8 ? "high" : "medium",
      title: t(locale, "营销分配未闭合", "Marketing allocation mismatch"),
      detail: t(
        locale,
        `分项营销与总营销相差 ${marketingGap.toFixed(1)}，提交前最好闭合预算口径。`,
        `Segment allocations differ from total marketing by ${marketingGap.toFixed(1)}.`
      ),
    });
  }

  if (channelGap > 2) {
    warnings.push({
      id: "channel-gap",
      severity: channelGap > 6 ? "high" : "medium",
      title: t(locale, "渠道比例未配平", "Channel mix not balanced"),
      detail: t(
        locale,
        `当前渠道合计为 ${channelTotal.toFixed(1)}%，建议尽量收敛到 100%。`,
        `Current channel mix totals ${channelTotal.toFixed(1)}%; try to converge to 100%.`
      ),
    });
  }

  if (pricePremium > 0.1 && serviceCoverage < 0.9) {
    warnings.push({
      id: "service-under-price",
      severity: "high",
      title: t(locale, "提价与服务投入不匹配", "Rate premium outruns service support"),
      detail: t(
        locale,
        "你的价格已经明显高于基线，但前厅/客房/培训投入偏弱，容易在高入住时失守。",
        "Rates are above baseline while service support remains thin."
      ),
    });
  }

  if (otaMix > 0.48 && directMix < 0.36) {
    warnings.push({
      id: "ota-dependence",
      severity: "medium",
      title: t(locale, "OTA 依赖偏高", "OTA dependency is elevated"),
      detail: t(
        locale,
        "当前流量更依赖 OTA，短期有利于冲量，但净收益与品牌沉淀可能被稀释。",
        "The plan leans heavily on OTA volume, which can dilute net yield."
      ),
    });
  }

  if (values.newLoanAmount > 0 && totalCapex < 4) {
    warnings.push({
      id: "loan-without-capex",
      severity: "low",
      title: t(locale, "新增贷款利用率偏低", "New debt lacks a clear use case"),
      detail: t(
        locale,
        "本轮新增贷款高于投资动作，容易让负债先上去、但经营改善滞后。",
        "Debt is rising faster than investment, which can widen execution risk."
      ),
    });
  }

  if (signals.find((signal) => signal.id === "risk")?.score ?? 0 >= 72) {
    warnings.push({
      id: "high-execution-risk",
      severity: "high",
      title: t(locale, "执行难度很高", "Execution difficulty is high"),
      detail: t(
        locale,
        "这套策略不是不能打，但它更依赖团队协同、服务兑现和预算纪律。",
        "This strategy can work, but only if execution discipline stays strong."
      ),
    });
  }

  const archetype =
    totalCapex >= 10 && values.capexTechnology + values.capexFacilities >= 5
      ? {
          id: "brand_rebuild" as const,
          label: t(locale, "品牌重塑型", "Brand rebuild"),
          summary: t(
            locale,
            "偏向中长期：通过设施、技术和 ESG 投入换取后续轮次的品牌与承接能力。",
            "A longer-horizon posture built on asset, tech, and ESG investment."
          ),
        }
      : pricePremium > 0.06 && directMix >= 0.48
        ? {
            id: "premium_yield" as const,
            label: t(locale, "高收益定价型", "Premium yield"),
            summary: t(
              locale,
              "目标是提升 ADR 和净收益，依赖直连、企业协议和品牌兑现力。",
              "Optimizes ADR and net yield through direct and premium demand."
            ),
          }
        : leisureBias >= 0.42 && otaMix >= 0.32 && pricePremium <= 0.02
          ? {
              id: "demand_grab" as const,
              label: t(locale, "冲量拉新型", "Demand grab"),
              summary: t(
                locale,
                "偏向抢市场和冲入住，需要后端服务和渠道成本控制跟上。",
                "Chases occupancy and share, but needs stronger cost control."
              ),
            }
          : financingPressure < 0.3 &&
              values.loanRepayment >= values.newLoanAmount &&
              values.marketingTotal <= baseline.marketingTotal
            ? {
                id: "cash_defense" as const,
                label: t(locale, "现金防守型", "Cash defense"),
                summary: t(
                  locale,
                  "优先守住现金和资产安全，更适合压力轮次或逆风环境。",
                  "Protects cash and downside resilience in tougher rounds."
                ),
              }
            : {
                id: "balanced" as const,
                label: t(locale, "均衡增长型", "Balanced growth"),
                summary: t(
                  locale,
                  "在收益、品牌和运营之间保持相对平衡，适合作为默认竞争姿态。",
                  "Balances revenue, brand, and operations for steady competition."
                ),
              };

  const readinessScore = clamp(
    82 -
      marketingGap * 2.2 -
      channelGap * 2.2 -
      Math.max(0, (signals.find((signal) => signal.id === "risk")?.score ?? 0) - 58) * 0.55 +
      Math.max(0, (signals.find((signal) => signal.id === "service")?.score ?? 0) - 55) * 0.45,
    28,
    98
  );

  const suggestions: StrategySuggestion[] = [];

  if (archetype.id === "premium_yield") {
    suggestions.push({
      id: "premium-direct",
      title: t(locale, "守住高收益渠道", "Protect high-yield channels"),
      detail: t(
        locale,
        "如果准备继续拉高价格，最好同步抬升企业协议、直销和 GDS 的承接能力。",
        "If rates stay high, protect direct, corporate, and GDS capture."
      ),
    });
  }

  if (archetype.id === "demand_grab") {
    suggestions.push({
      id: "demand-support",
      title: t(locale, "冲量要配服务", "Support demand with service"),
      detail: t(
        locale,
        "冲入住时，前厅、客房、培训和福利至少要同步微增，不然容易出现满意度回撤。",
        "If you push occupancy, front desk, housekeeping, and training should rise too."
      ),
    });
  }

  if (archetype.id === "brand_rebuild") {
    suggestions.push({
      id: "brand-harvest",
      title: t(locale, "下一轮要开始收割", "Prepare to monetize next round"),
      detail: t(
        locale,
        "设施和技术投入不该长期只停留在成本端，下一轮应尝试提价或强化团体承接。",
        "Asset and tech spending should translate into pricing or group capture next round."
      ),
    });
  }

  if (warnings.some((warning) => warning.id === "service-under-price")) {
    suggestions.push({
      id: "service-floor",
      title: t(locale, "先补服务底盘", "Raise the service floor"),
      detail: t(
        locale,
        "前厅、客房、培训三项是最值得优先补的，通常比继续堆营销更稳。",
        "Front desk, housekeeping, and training are the safest first fixes."
      ),
    });
  }

  if (warnings.some((warning) => warning.id === "ota-dependence")) {
    suggestions.push({
      id: "direct-shift",
      title: t(locale, "把一部分流量转回直连", "Shift some volume back to direct"),
      detail: t(
        locale,
        "不需要激进砍 OTA，但可以逐步把新增预算转向企业协议、会员和直销转化。",
        "Do not slash OTA abruptly, but move incremental budget toward direct conversion."
      ),
    });
  }

  if (suggestions.length < 3) {
    suggestions.push({
      id: "segment-focus",
      title: t(locale, "把打法写得更尖锐", "Make the posture sharper"),
      detail: t(
        locale,
        "当前策略已经有方向，但还可以进一步明确 1-2 个主攻客群，避免平均用力。",
        "The plan has direction, but could focus harder on one or two priority segments."
      ),
    });
  }

  return {
    archetype,
    readinessScore: Math.round(readinessScore),
    readinessLabel:
      readinessScore >= 82
        ? t(locale, "可直接出手", "Ready to execute")
        : readinessScore >= 64
          ? t(locale, "可以提交，但建议再打磨", "Playable but worth refining")
          : t(locale, "建议继续修正", "Needs more polish"),
    headline: t(
      locale,
      `${archetype.label}，当前更像一套${businessBias > leisureBias ? "商旅导向" : "需求导向"}打法。关键看你能不能把价格、渠道和服务兑现成同一个故事。`,
      `${archetype.label}. The plan will work best if pricing, channels, and service tell the same story.`
    ),
    focusSegments: getFocusSegments(values, locale),
    signals,
    warnings: warnings.slice(0, 5),
    suggestions: suggestions.slice(0, 3),
  };
}
