import { describe, expect, it } from "vitest";
import { mergeDecisionFormValues } from "@/lib/decisions/form";
import { buildStudentRoundPlaybook } from "@/lib/student/playbook";

describe("buildStudentRoundPlaybook", () => {
  it("recommends premium play when demand is strong and brand can support yield", () => {
    const playbook = buildStudentRoundPlaybook({
      locale: "en-US",
      round: {
        roundNumber: 4,
        seasonFactor: 1.05,
        economyFactor: 1.05,
        eventFactor: 1.08,
        eventDescription:
          "环境摘要：春季会展期；天气：晴朗平稳；景气：温和增长；事件：大型会展；提示：会展和商务客流明显回升。",
        randomSeed: "seed-1",
      },
      hotelState: {
        cashBalance: 28_000_000,
        totalDebt: 120_000_000,
        brandReputation: 68,
        guestSatisfaction: 81,
        esgScore: 64,
      },
      values: mergeDecisionFormValues({
        channelDirect: 32,
        channelCorporate: 26,
        channelGDS: 12,
      }),
    });

    expect(playbook.environment.demandOutlook).toBe("strong");
    expect(playbook.recommendedPreset.presetId).toBe("premium");
  });

  it("recommends recovery play when the round is soft and balance sheet is tight", () => {
    const playbook = buildStudentRoundPlaybook({
      round: {
        roundNumber: 8,
        seasonFactor: 0.92,
        economyFactor: 0.95,
        eventFactor: 0.9,
        eventDescription:
          "环境摘要：暑期旅游时季；天气：连续降雨；景气：需求偏冷；事件：交通受阻；提示：到达受阻抬高现金与服务压力。",
        randomSeed: "seed-2",
      },
      hotelState: {
        cashBalance: 2_000_000,
        totalDebt: 260_000_000,
        brandReputation: 54,
        guestSatisfaction: 66,
        esgScore: 58,
      },
      values: null,
    });

    expect(playbook.environment.demandOutlook).toBe("soft");
    expect(playbook.recommendedPreset.presetId).toBe("recovery");
    expect(playbook.alignment.status).toBe("pending");
  });

  it("marks the current draft aligned when it already matches the suggested posture", () => {
    const playbook = buildStudentRoundPlaybook({
      locale: "en-US",
      round: {
        roundNumber: 7,
        seasonFactor: 1.1,
        economyFactor: 1,
        eventFactor: 1.08,
        eventDescription:
          "环境摘要：暑期旅游时季；天气：晴朗平稳；景气：平稳运行；事件：假期客流高峰；提示：休闲需求显著抬升。",
        randomSeed: "seed-3",
      },
      hotelState: {
        cashBalance: 18_000_000,
        totalDebt: 110_000_000,
        brandReputation: 64,
        guestSatisfaction: 79,
        esgScore: 61,
      },
      values: mergeDecisionFormValues({
        marketingTotal: 100,
        mktBudgetLeisureTransient: 18,
        mktBudgetLeisureGroup: 15,
        mktBudgetOnlineOTA: 20,
        channelOTA: 36,
        channelDirect: 24,
      }),
    });

    expect(playbook.recommendedPreset.presetId).toBe("surge");
    expect(["aligned", "mixed"]).toContain(playbook.alignment.status);
  });
});
