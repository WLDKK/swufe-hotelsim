import { describe, expect, it } from "vitest";
import {
  getClassStatusLabel,
  getDecisionStatusLabel,
  getRoundStatusLabel,
  getSemesterStatusLabel,
  getTeamMemberRoleLabel,
  getUserRoleLabel,
} from "@/i18n/status-labels";

describe("status label helpers", () => {
  it("maps known class, round, and decision statuses for zh-CN", () => {
    expect(getClassStatusLabel("zh-CN", "IN_PROGRESS")).toBe("\u8fdb\u884c\u4e2d");
    expect(getRoundStatusLabel("zh-CN", "PENDING")).toBe("\u5f85\u5904\u7406");
    expect(getDecisionStatusLabel("zh-CN", "NOT_STARTED")).toBe("\u672a\u5f00\u59cb");
    expect(getSemesterStatusLabel("zh-CN", "ACTIVE")).toBe("\u8fdb\u884c\u4e2d");
    expect(getUserRoleLabel("zh-CN", "TEACHER")).toBe("\u6559\u5e08");
    expect(getTeamMemberRoleLabel("zh-CN", "LEADER")).toBe("\u961f\u957f");
  });

  it("maps known class, round, and decision statuses for en-US", () => {
    expect(getClassStatusLabel("en-US", "COMPLETED")).toBe("Completed");
    expect(getRoundStatusLabel("en-US", "PROCESSING")).toBe("Processing");
    expect(getDecisionStatusLabel("en-US", "SUBMITTED")).toBe("Submitted");
    expect(getSemesterStatusLabel("en-US", "ARCHIVED")).toBe("Archived");
    expect(getUserRoleLabel("en-US", "ADMIN")).toBe("Admin");
    expect(getTeamMemberRoleLabel("en-US", "MEMBER")).toBe("Member");
  });

  it("falls back to the raw value when the enum is unknown", () => {
    expect(getClassStatusLabel("en-US", "CUSTOM")).toBe("CUSTOM");
    expect(getRoundStatusLabel("zh-CN", "CUSTOM")).toBe("CUSTOM");
    expect(getDecisionStatusLabel("en-US", "CUSTOM")).toBe("CUSTOM");
  });
});
