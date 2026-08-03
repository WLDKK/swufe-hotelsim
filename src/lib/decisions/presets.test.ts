import { describe, expect, it } from "vitest";
import { mergeDecisionFormValues } from "@/lib/decisions/form";
import { applyDecisionPreset, DECISION_PRESETS } from "@/lib/decisions/presets";

describe("decision presets", () => {
  it("applies preset values on top of an existing draft", () => {
    const premium = DECISION_PRESETS.find((preset) => preset.id === "premium");
    const current = mergeDecisionFormValues({
      loanRepayment: 5,
    });

    expect(premium).toBeTruthy();

    const next = applyDecisionPreset(current, premium!);

    expect(next.priceBusinessTransient).toBe(710);
    expect(next.channelDirect + next.channelOTA + next.channelTravelAgent + next.channelCorporate + next.channelGDS).toBe(100);
  });

  it("keeps the preset marketing allocation internally closed", () => {
    const surge = DECISION_PRESETS.find((preset) => preset.id === "surge");

    expect(surge).toBeTruthy();

    const total =
      (surge?.values.mktBudgetBusinessTransient ?? 0) +
      (surge?.values.mktBudgetBusinessGroup ?? 0) +
      (surge?.values.mktBudgetLeisureTransient ?? 0) +
      (surge?.values.mktBudgetLeisureGroup ?? 0) +
      (surge?.values.mktBudgetGovernment ?? 0) +
      (surge?.values.mktBudgetOnlineOTA ?? 0) +
      (surge?.values.mktBudgetAirlineCrew ?? 0) +
      (surge?.values.mktBudgetLongStay ?? 0);

    expect(total).toBe(surge?.values.marketingTotal);
  });
});
