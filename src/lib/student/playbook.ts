import type { DecisionPreset } from "@/lib/decisions/presets";
import type { DecisionFormValues } from "@/lib/decisions/form";
import { analyzeDecisionStrategy } from "@/lib/simulation/strategy-insights";
import {
  describeRoundEnvironment,
  type RoundEnvironmentRecommendation,
} from "@/lib/simulation/environment";

type SupportedLocale = "zh-CN" | "en-US";

type HotelStateSummary = {
  cashBalance: number;
  totalDebt: number;
  brandReputation: number;
  guestSatisfaction: number;
  esgScore: number;
} | null;

export type StudentRoundEnvironmentInput = {
  roundNumber: number;
  seasonFactor: number;
  economyFactor: number;
  eventFactor: number;
  eventDescription: string | null;
  randomSeed: string | null;
};

export type StudentPlaybookAction = {
  id: "pricing" | "marketing" | "operations" | "finance";
  title: string;
  detail: string;
};

export type StudentPlaybookAlignment = {
  status: "aligned" | "mixed" | "misaligned" | "pending";
  title: string;
  detail: string;
};

export type StudentRoundPlaybook = {
  environment: RoundEnvironmentRecommendation;
  headline: string;
  scenarioSummary: string;
  actions: StudentPlaybookAction[];
  recommendedPreset: {
    presetId: DecisionPreset["id"];
    reason: string;
  };
  alignment: StudentPlaybookAlignment;
};

function t(locale: SupportedLocale, zh: string, en: string) {
  return locale === "zh-CN" ? zh : en;
}

function resolveRecommendedPreset(input: {
  environment: RoundEnvironmentRecommendation;
  hotelState: HotelStateSummary;
}) {
  const cashBalance = input.hotelState?.cashBalance ?? 20_000_000;
  const totalDebt = input.hotelState?.totalDebt ?? 0;
  const brandReputation = input.hotelState?.brandReputation ?? 60;
  const guestSatisfaction = input.hotelState?.guestSatisfaction ?? 72;
  const demandOutlook = input.environment.demandOutlook;
  const disruptiveEvent =
    input.environment.eventId === "transport_disruption" ||
    input.environment.eventId === "public_health_alert";
  const leisurePeak =
    input.environment.eventId === "holiday_peak" ||
    input.environment.eventId === "concert";
  const businessWindow = input.environment.eventId === "expo";
  const softBalanceSheet = cashBalance < 8_000_000 || totalDebt > 220_000_000;
  const serviceFragile = guestSatisfaction < 70 || brandReputation < 58;

  if (demandOutlook === "soft" || disruptiveEvent || softBalanceSheet) {
    return {
      presetId: "recovery" as const,
      reason: "defensive",
    };
  }

  if (demandOutlook === "strong" && leisurePeak && !serviceFragile) {
    return {
      presetId: "surge" as const,
      reason: "occupancy",
    };
  }

  if (
    demandOutlook === "strong" &&
    (businessWindow || brandReputation >= 62) &&
    !softBalanceSheet
  ) {
    return {
      presetId: "premium" as const,
      reason: "yield",
    };
  }

  return {
    presetId: "balanced" as const,
    reason: "steady",
  };
}

function buildPresetReason(input: {
  locale: SupportedLocale;
  presetId: DecisionPreset["id"];
  environment: RoundEnvironmentRecommendation;
  hotelState: HotelStateSummary;
}) {
  const cashBalance = input.hotelState?.cashBalance ?? 20_000_000;
  const totalDebt = input.hotelState?.totalDebt ?? 0;
  const brandReputation = input.hotelState?.brandReputation ?? 60;
  const guestSatisfaction = input.hotelState?.guestSatisfaction ?? 72;

  switch (input.presetId) {
    case "premium":
      return t(
        input.locale,
        `本轮需求偏强，且当前品牌 ${brandReputation.toFixed(0)}、满意度 ${guestSatisfaction.toFixed(
          0
        )} 还有提价承接空间，更适合走高收益打法。`,
        `Demand is strong and current brand/satisfaction can support a higher-yield posture.`
      );
    case "surge":
      return t(
        input.locale,
        `本轮更像抢量窗口，尤其适合围绕 ${input.environment.eventLabel} 放大休闲和渠道流量，但要守住服务兑现。`,
        `This round looks like a volume window, especially around ${input.environment.eventLabel}.`
      );
    case "recovery":
      return t(
        input.locale,
        `当前更应优先稳住现金与执行面，现金 ${cashBalance.toFixed(
          0
        )}、债务 ${totalDebt.toFixed(0)} 下不宜再激进加杠杆。`,
        `This round should protect cash and execution before taking more risk.`
      );
    default:
      return t(
        input.locale,
        `环境偏中性，适合先做均衡配置，再围绕 ${input.environment.demandOutlook} 需求信号微调。`,
        `Conditions are balanced, so a steady setup is the safest base before fine tuning.`
      );
  }
}

function buildAlignment(input: {
  locale: SupportedLocale;
  presetId: DecisionPreset["id"];
  values: DecisionFormValues | null | undefined;
  hotelState: HotelStateSummary;
}) {
  if (!input.values) {
    return {
      status: "pending" as const,
      title: t(input.locale, "当前还没有草稿", "No draft yet"),
      detail: t(
        input.locale,
        "你可以先套用建议打法，再在表单里做细调。",
        "Start from the recommended preset, then fine tune in the form."
      ),
    };
  }

  const snapshot = analyzeDecisionStrategy({
    values: input.values,
    hotelState: input.hotelState,
    locale: input.locale,
  });

  const preferredArchetypes: Record<
    DecisionPreset["id"],
    Array<typeof snapshot.archetype.id>
  > = {
    balanced: ["balanced", "brand_rebuild"],
    premium: ["premium_yield", "brand_rebuild"],
    surge: ["demand_grab", "balanced"],
    recovery: ["cash_defense", "brand_rebuild"],
  };

  const currentArchetype = snapshot.archetype.id;
  const matchingArchetypes = preferredArchetypes[input.presetId];

  if (matchingArchetypes[0] === currentArchetype) {
    return {
      status: "aligned" as const,
      title: t(input.locale, "当前草稿与环境建议一致", "Draft matches the round"),
      detail: t(
        input.locale,
        `你现在的打法已经接近“${snapshot.archetype.label}”，可以重点做预算闭合和细节修正。`,
        `Your draft already looks close to "${snapshot.archetype.label}".`
      ),
    };
  }

  if (matchingArchetypes.includes(currentArchetype)) {
    return {
      status: "mixed" as const,
      title: t(input.locale, "方向大体吻合，但还不够锋利", "Direction fits, but it can be sharper"),
      detail: t(
        input.locale,
        `当前是“${snapshot.archetype.label}”，和系统建议不冲突，但还可以把渠道、价格和服务再拉齐。`,
        `The current posture is "${snapshot.archetype.label}", so it is workable but not fully aligned yet.`
      ),
    };
  }

  return {
    status: "misaligned" as const,
    title: t(input.locale, "当前草稿和环境节奏有错位", "Draft and round conditions are out of sync"),
    detail: t(
      input.locale,
      `你现在更像“${snapshot.archetype.label}”，但本轮更适合另一种节奏，建议先看推荐打法再决定是否切换。`,
      `The draft currently behaves like "${snapshot.archetype.label}", while this round suggests a different posture.`
    ),
  };
}

export function buildStudentRoundPlaybook(input: {
  round: StudentRoundEnvironmentInput;
  locale?: SupportedLocale;
  hotelState?: HotelStateSummary;
  values?: DecisionFormValues | null;
}): StudentRoundPlaybook {
  const locale = input.locale ?? "zh-CN";
  const environment = describeRoundEnvironment({
    roundNumber: input.round.roundNumber,
    seasonFactor: input.round.seasonFactor,
    economyFactor: input.round.economyFactor,
    eventFactor: input.round.eventFactor,
    eventDescription: input.round.eventDescription,
    randomSeed: input.round.randomSeed,
  });
  const recommendation = resolveRecommendedPreset({
    environment,
    hotelState: input.hotelState ?? null,
  });

  return {
    environment,
    headline:
      environment.demandOutlook === "strong"
        ? t(
            locale,
            "本轮是可以主动做文章的窗口，但重点不是盲目冲量，而是把高价值需求和执行能力对齐。",
            "This round rewards active moves, but only when demand quality and execution stay aligned."
          )
        : environment.demandOutlook === "soft"
          ? t(
              locale,
              "本轮更像压力测试，先守住现金、安全边际和服务底盘，再谈增量机会。",
              "This round behaves like a pressure test, so cash safety and service stability matter first."
            )
          : t(
              locale,
              "本轮环境相对均衡，真正拉开差距的通常不是赌方向，而是执行完整度。",
              "Conditions are balanced this round, so execution quality is what creates separation."
            ),
    scenarioSummary: t(
      locale,
      `${environment.monthLabel}处于${environment.seasonLabel}，天气为${environment.weatherLabel}，景气判断为${environment.economyLabel}，当前事件为${environment.eventLabel}。`,
      `${environment.monthLabel} sits in ${environment.seasonLabel} with ${environment.weatherLabel}, ${environment.economyLabel}, and ${environment.eventLabel}.`
    ),
    actions: [
      {
        id: "pricing",
        title: t(locale, "定价信号", "Pricing"),
        detail: environment.pricingHint,
      },
      {
        id: "marketing",
        title: t(locale, "营销抓手", "Marketing"),
        detail: environment.marketingHint,
      },
      {
        id: "operations",
        title: t(locale, "运营重点", "Operations"),
        detail: environment.operationsHint,
      },
      {
        id: "finance",
        title: t(locale, "资金动作", "Finance"),
        detail: environment.financeHint,
      },
    ],
    recommendedPreset: {
      presetId: recommendation.presetId,
      reason: buildPresetReason({
        locale,
        presetId: recommendation.presetId,
        environment,
        hotelState: input.hotelState ?? null,
      }),
    },
    alignment: buildAlignment({
      locale,
      presetId: recommendation.presetId,
      values: input.values,
      hotelState: input.hotelState ?? null,
    }),
  };
}
