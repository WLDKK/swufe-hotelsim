import { describe, expect, it } from "vitest";
import { buildPlatformAlerts } from "./alerts";

describe("buildPlatformAlerts", () => {
  it("derives prioritized actionable alerts from observability signals", () => {
    const result = buildPlatformAlerts(
      {
        summary: {
          activeClasses: 2,
          activeProcessingRounds: 1,
          overduePendingRounds: 1,
          classesAwaitingSubmissions: 2,
          missingSubmissions: 3,
          ungradedResults: 4,
          auditEventsLast24Hours: 0,
        },
        roundSignals: [
          {
            classId: "class-processing",
            className: "HotelSim Alpha",
            classStatus: "IN_PROGRESS",
            roundId: "round-processing",
            roundNumber: 3,
            roundStatus: "PROCESSING",
            deadline: new Date("2026-03-29T08:00:00.000Z"),
            openedAt: new Date("2026-03-29T09:00:00.000Z"),
            totalTeams: 4,
            submittedTeams: 4,
            missingTeams: 0,
            overdue: false,
          },
          {
            classId: "class-overdue",
            className: "HotelSim Beta",
            classStatus: "IN_PROGRESS",
            roundId: "round-overdue",
            roundNumber: 2,
            roundStatus: "PENDING",
            deadline: new Date("2026-03-29T07:00:00.000Z"),
            openedAt: new Date("2026-03-29T06:00:00.000Z"),
            totalTeams: 5,
            submittedTeams: 3,
            missingTeams: 2,
            overdue: true,
          },
          {
            classId: "class-pending",
            className: "HotelSim Gamma",
            classStatus: "IN_PROGRESS",
            roundId: "round-pending",
            roundNumber: 1,
            roundStatus: "PENDING",
            deadline: new Date("2026-03-30T15:00:00.000Z"),
            openedAt: new Date("2026-03-30T08:00:00.000Z"),
            totalTeams: 3,
            submittedTeams: 2,
            missingTeams: 1,
            overdue: false,
          },
        ],
        gradingSignals: [
          {
            classId: "class-grading",
            className: "HotelSim Delta",
            ungradedResults: 4,
            latestUngradedRound: 5,
          },
        ],
        auditActions: [],
        generatedAt: "2026-03-30T10:00:00.000Z",
      },
      { limit: 10 }
    );

    expect(result.summary).toEqual({
      total: 5,
      critical: 1,
      high: 1,
      medium: 2,
      info: 1,
      open: 5,
      acknowledged: 0,
      muted: 0,
      dispatchable: 5,
    });
    expect(result.alerts).toHaveLength(5);
    expect(result.alerts[0]).toMatchObject({
      id: "processing:round-processing",
      severity: "critical",
      category: "processing",
      href: "/admin/classes/class-processing",
    });
    expect(result.alerts[1]).toMatchObject({
      id: "submission-overdue:round-overdue",
      severity: "high",
      category: "submission",
    });
    expect(result.alerts[2]).toMatchObject({
      id: "submission-pending:round-pending",
      severity: "medium",
      category: "submission",
    });
    expect(result.alerts[3]).toMatchObject({
      id: "grading:class-grading",
      severity: "medium",
      category: "grading",
    });
    expect(result.alerts[4]).toMatchObject({
      id: "activity:quiet-platform",
      severity: "info",
      category: "activity",
    });
  });

  it("preserves full summary counts when the returned alert list is limited", () => {
    const result = buildPlatformAlerts(
      {
        summary: {
          activeClasses: 1,
          activeProcessingRounds: 0,
          overduePendingRounds: 0,
          classesAwaitingSubmissions: 1,
          missingSubmissions: 1,
          ungradedResults: 1,
          auditEventsLast24Hours: 4,
        },
        roundSignals: [
          {
            classId: "class-pending",
            className: "HotelSim Gamma",
            classStatus: "IN_PROGRESS",
            roundId: "round-pending",
            roundNumber: 2,
            roundStatus: "PENDING",
            deadline: new Date("2026-03-30T15:00:00.000Z"),
            openedAt: new Date("2026-03-30T08:00:00.000Z"),
            totalTeams: 4,
            submittedTeams: 3,
            missingTeams: 1,
            overdue: false,
          },
        ],
        gradingSignals: [
          {
            classId: "class-grading",
            className: "HotelSim Delta",
            ungradedResults: 1,
            latestUngradedRound: 2,
          },
        ],
        auditActions: [],
        generatedAt: "2026-03-30T10:00:00.000Z",
      },
      { limit: 1 }
    );

    expect(result.summary.total).toBe(2);
    expect(result.summary.medium).toBe(2);
    expect(result.summary.open).toBe(2);
    expect(result.summary.dispatchable).toBe(2);
    expect(result.alerts).toHaveLength(1);
  });
});
