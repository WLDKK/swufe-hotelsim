import { describe, expect, it } from "vitest";
import { getProcessReadiness } from "./process-readiness";

describe("getProcessReadiness", () => {
  it("returns processable when every team has a submitted decision in a pending round", () => {
    expect(
      getProcessReadiness({
        currentRoundStatus: "PENDING",
        teamCount: 3,
        decisionStatuses: ["SUBMITTED", "SUBMITTED", "SUBMITTED"],
      })
    ).toEqual({
      submittedCount: 3,
      missingDecisionCount: 0,
      nonSubmittedCount: 0,
      canProcess: true,
    });
  });

  it("blocks processing when some teams still have draft decisions", () => {
    expect(
      getProcessReadiness({
        currentRoundStatus: "PENDING",
        teamCount: 4,
        decisionStatuses: ["SUBMITTED", "DRAFT", "SUBMITTED", "DRAFT"],
      })
    ).toEqual({
      submittedCount: 2,
      missingDecisionCount: 0,
      nonSubmittedCount: 2,
      canProcess: false,
    });
  });

  it("blocks processing when some teams do not have a decision row yet", () => {
    expect(
      getProcessReadiness({
        currentRoundStatus: "PENDING",
        teamCount: 4,
        decisionStatuses: ["SUBMITTED", "SUBMITTED"],
      })
    ).toEqual({
      submittedCount: 2,
      missingDecisionCount: 2,
      nonSubmittedCount: 0,
      canProcess: false,
    });
  });

  it("blocks processing outside a pending round even if all teams submitted", () => {
    expect(
      getProcessReadiness({
        currentRoundStatus: "PROCESSING",
        teamCount: 2,
        decisionStatuses: ["SUBMITTED", "SUBMITTED"],
      }).canProcess
    ).toBe(false);
  });
});
