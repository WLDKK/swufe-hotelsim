import { describe, expect, it } from "vitest";
import { mergeDecisionFormValues } from "@/lib/decisions/form";
import { analyzeDecisionStrategy } from "@/lib/simulation/strategy-insights";

describe("analyzeDecisionStrategy", () => {
  it("identifies a premium-yield posture when pricing and direct mix are high", () => {
    const snapshot = analyzeDecisionStrategy({
      locale: "zh-CN",
      values: mergeDecisionFormValues({
        priceBusinessTransient: 720,
        priceBusinessGroup: 650,
        priceLeisureTransient: 560,
        priceLeisureGroup: 490,
        channelDirect: 34,
        channelCorporate: 28,
        channelGDS: 16,
        channelOTA: 12,
        channelTravelAgent: 6,
        marketingTotal: 88,
      }),
    });

    expect(snapshot.archetype.id).toBe("premium_yield");
    expect(snapshot.signals.find((signal) => signal.id === "revenue")?.score).toBeGreaterThan(60);
  });

  it("flags plan hygiene issues when marketing and channels do not close", () => {
    const snapshot = analyzeDecisionStrategy({
      locale: "zh-CN",
      values: mergeDecisionFormValues({
        marketingTotal: 100,
        mktBudgetBusinessTransient: 10,
        mktBudgetBusinessGroup: 10,
        mktBudgetLeisureTransient: 10,
        mktBudgetLeisureGroup: 10,
        mktBudgetGovernment: 10,
        mktBudgetOnlineOTA: 10,
        mktBudgetAirlineCrew: 10,
        mktBudgetLongStay: 10,
        channelDirect: 18,
        channelOTA: 44,
        channelTravelAgent: 12,
        channelCorporate: 12,
        channelGDS: 6,
      }),
    });

    expect(snapshot.warnings.some((warning) => warning.id === "marketing-gap")).toBe(true);
    expect(snapshot.warnings.some((warning) => warning.id === "channel-gap")).toBe(true);
  });
});
