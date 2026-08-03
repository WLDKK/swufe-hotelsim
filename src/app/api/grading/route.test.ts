import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/access", () => ({
  getAccessibleClassRecord: vi.fn(),
}));

vi.mock("@/lib/api/session", () => ({
  requireApiSession: vi.fn(),
  requireApiRoles: vi.fn(),
}));

vi.mock("@/lib/dal/results", () => ({
  getRoundResultById: vi.fn(),
}));

vi.mock("@/lib/dal/judge-scores", () => ({
  upsertJudgeScoreForResult: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  recordAuditLog: vi.fn(),
}));

import { PATCH } from "./route";
import { recordAuditLog } from "@/lib/audit";
import { getAccessibleClassRecord } from "@/lib/api/access";
import { getRoundResultById } from "@/lib/dal/results";
import { upsertJudgeScoreForResult } from "@/lib/dal/judge-scores";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";

const mockedRequireApiSession = vi.mocked(requireApiSession);
const mockedRequireApiRoles = vi.mocked(requireApiRoles);
const mockedGetAccessibleClassRecord = vi.mocked(getAccessibleClassRecord);
const mockedGetRoundResultById = vi.mocked(getRoundResultById);
const mockedUpsertJudgeScoreForResult = vi.mocked(upsertJudgeScoreForResult);
const mockedRecordAuditLog = vi.mocked(recordAuditLog);

function createMockRoundResultLookup() {
  return {
    id: "result-1",
    teamId: "team-1",
    roundId: "round-1",
    roundNumber: 2,
    occupancyRate: 0.82,
    adr: 598,
    revpar: 490,
    totalRoomsSold: 400,
    totalRoomsAvailable: 500,
    segmentResults: [],
    roomRevenue: 1_000_000,
    fbRevenue: 200_000,
    otherRevenue: 50_000,
    totalRevenue: 1_250_000,
    totalOpex: 700_000,
    totalMarketing: 80_000,
    totalCapex: 60_000,
    depreciationExpense: 50_000,
    interestExpense: 25_000,
    taxExpense: 40_000,
    grossOperatingProfit: 470_000,
    ebitda: 420_000,
    netProfit: 210_000,
    profitMargin: 0.168,
    overallMarketShare: 0.31,
    brandReputationEnd: 78,
    onlineRatingEnd: 4.3,
    guestSatisfactionEnd: 86,
    esgScoreEnd: 71,
    cashBalanceEnd: 52_000_000,
    totalDebtEnd: 180_000_000,
    debtToEquityRatio: 1.5,
    returnOnEquity: 0.08,
    rankRevenue: 1,
    rankProfit: 1,
    rankOccupancy: 1,
    rankOverall: 1,
    systemScore: 88,
    systemScoreBreakdown: {},
    penaltyScore: 0,
    explanationLog: [],
    judgeScoreAverage: null,
    judgeScoreCount: 0,
    finalScore: 88,
    teacherScore: null,
    teacherComment: null,
    createdAt: new Date("2026-03-16T10:00:00.000Z"),
    team: {
      id: "team-1",
      classId: "class-1",
      name: "Team Phoenix",
      hotelName: "Phoenix Grand Hotel",
      color: "#8B1A1A",
    },
    round: {
      id: "round-1",
      classId: "class-1",
      roundNumber: 2,
      status: "COMPLETED",
      processedAt: new Date("2026-03-16T10:00:00.000Z"),
      rulesetId: "ruleset-1",
      rulesetVersion: "v1",
      rulesetName: "Baseline",
      randomSeed: "seed-1",
    },
    judgeScores: [],
  } as Awaited<ReturnType<typeof getRoundResultById>>;
}

describe("PATCH /api/grading", () => {
  beforeEach(() => {
    mockedRequireApiSession.mockResolvedValue({
      session: {
        user: {
          id: "teacher-1",
          role: "TEACHER",
        },
      },
    } as Awaited<ReturnType<typeof requireApiSession>>);
    mockedRequireApiRoles.mockReturnValue(null);
  });

  it("writes only the grading fields that were provided", async () => {
    mockedGetRoundResultById.mockResolvedValue(createMockRoundResultLookup());
    mockedGetAccessibleClassRecord.mockResolvedValue({
      id: "class-1",
    } as Awaited<ReturnType<typeof getAccessibleClassRecord>>);
    mockedUpsertJudgeScoreForResult.mockResolvedValue({
      ...createMockRoundResultLookup(),
      teacherScore: null,
      teacherComment: "Tighten weekday pricing strategy.",
      judgeScores: [],
    } as unknown as Awaited<ReturnType<typeof upsertJudgeScoreForResult>>);

    const response = (await PATCH(
      new NextRequest("http://localhost/api/grading", {
        method: "PATCH",
        body: JSON.stringify({
          resultId: "result-1",
          teacherComment: "Tighten weekday pricing strategy.",
        }),
      })
    ))!;

    expect(response.status).toBe(200);
    expect(mockedUpsertJudgeScoreForResult).toHaveBeenCalledWith({
      resultId: "result-1",
      judgeId: "teacher-1",
      comment: "Tighten weekday pricing strategy.",
      score: undefined,
    });
    expect(mockedRecordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "grading.save",
        entityType: "round_result",
        entityId: "result-1",
      })
    );

    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      data: {
        result: {
          id: "result-1",
          teacherComment: "Tighten weekday pricing strategy.",
        },
      },
    });
  });

  it("rejects malformed payloads before attempting database access", async () => {
    const response = (await PATCH(
      new NextRequest("http://localhost/api/grading", {
        method: "PATCH",
        body: JSON.stringify({}),
      })
    ))!;

    expect(response.status).toBe(400);
    expect(mockedGetRoundResultById).not.toHaveBeenCalled();
    expect(mockedRecordAuditLog).not.toHaveBeenCalled();
  });

  it("returns 404 when the teacher cannot access the result's class", async () => {
    mockedGetRoundResultById.mockResolvedValue(createMockRoundResultLookup());
    mockedGetAccessibleClassRecord.mockResolvedValue(null);

    const response = (await PATCH(
      new NextRequest("http://localhost/api/grading", {
        method: "PATCH",
        body: JSON.stringify({
          resultId: "result-1",
          teacherScore: 91.5,
        }),
      })
    ))!;

    expect(response.status).toBe(404);
    expect(mockedUpsertJudgeScoreForResult).not.toHaveBeenCalled();
  });

  it("passes through session or role failures from the auth layer", async () => {
    mockedRequireApiSession.mockResolvedValue({
      response: NextResponse.json(
        {
          status: "error",
          message: "Authentication is required.",
        },
        { status: 401 }
      ),
    } as Awaited<ReturnType<typeof requireApiSession>>);

    const response = (await PATCH(
      new NextRequest("http://localhost/api/grading", {
        method: "PATCH",
        body: JSON.stringify({
          resultId: "result-1",
          teacherScore: 90,
        }),
      })
    ))!;

    expect(response.status).toBe(401);
  });
});
