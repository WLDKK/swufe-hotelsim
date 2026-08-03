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
  getLatestCompletedRoundNumberForClass: vi.fn(),
  getResultsForClassRound: vi.fn(),
}));

import { getAccessibleClassRecord } from "@/lib/api/access";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";
import {
  getLatestCompletedRoundNumberForClass,
  getResultsForClassRound,
} from "@/lib/dal/results";
import { GET } from "./route";

const mockedRequireApiSession = vi.mocked(requireApiSession);
const mockedRequireApiRoles = vi.mocked(requireApiRoles);
const mockedGetAccessibleClassRecord = vi.mocked(getAccessibleClassRecord);
const mockedGetLatestCompletedRoundNumberForClass = vi.mocked(
  getLatestCompletedRoundNumberForClass
);
const mockedGetResultsForClassRound = vi.mocked(getResultsForClassRound);

describe("/api/export/grades", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireApiSession.mockResolvedValue({
      session: {
        user: {
          id: "teacher-1",
          role: "TEACHER",
        },
      },
    } as Awaited<ReturnType<typeof requireApiSession>>);
    mockedRequireApiRoles.mockReturnValue(null);
    mockedGetAccessibleClassRecord.mockResolvedValue({
      id: "class-1",
    } as Awaited<ReturnType<typeof getAccessibleClassRecord>>);
  });

  it("exports the gradebook CSV with BOM for Excel-friendly downloads", async () => {
    mockedGetLatestCompletedRoundNumberForClass.mockResolvedValue(2);
    mockedGetResultsForClassRound.mockResolvedValue([
      {
        roundNumber: 2,
        rankOverall: 1,
        totalRevenue: 1280000,
        netProfit: 284000,
        occupancyRate: 0.83,
        adr: 688,
        revpar: 571.04,
        overallMarketShare: 0.31,
        guestSatisfactionEnd: 91,
        esgScoreEnd: 84,
        teacherScore: 95,
        teacherComment: "Strong pricing discipline",
        team: {
          name: "Team Atlas",
          hotelName: "Atlas Grand Hotel",
        },
      },
    ] as Awaited<ReturnType<typeof getResultsForClassRound>>);

    const response = (await GET(
      new NextRequest("http://localhost/api/export/grades?classId=class-1")
    ))!;

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    const csv = await response.text();
    expect(csv).toContain("teacherComment");
    expect(csv).toContain("Strong pricing discipline");
  });

  it("returns json when explicitly requested", async () => {
    mockedGetResultsForClassRound.mockResolvedValue([
      {
        roundNumber: 3,
        rankOverall: 2,
        totalRevenue: 980000,
        netProfit: 170000,
        occupancyRate: 0.78,
        adr: 620,
        revpar: 483.6,
        overallMarketShare: 0.22,
        guestSatisfactionEnd: 88,
        esgScoreEnd: 81,
        teacherScore: 90,
        teacherComment: "Good recovery",
        team: {
          name: "Team Harbor",
          hotelName: "Harbor Suites",
        },
      },
    ] as Awaited<ReturnType<typeof getResultsForClassRound>>);

    const response = (await GET(
      new NextRequest(
        "http://localhost/api/export/grades?classId=class-1&roundNumber=3&format=json"
      )
    ))!;

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      data: {
        roundNumber: 3,
        rows: [
          {
            teamName: "Team Harbor",
            teacherScore: 90,
          },
        ],
      },
    });
  });

  it("passes through auth failures from the session layer", async () => {
    mockedRequireApiSession.mockResolvedValue({
      response: NextResponse.json(
        {
          status: "error",
          message: "Authentication is required.",
        },
        { status: 401 }
      ),
    } as Awaited<ReturnType<typeof requireApiSession>>);

    const response = (await GET(
      new NextRequest("http://localhost/api/export/grades?classId=class-1")
    ))!;

    expect(response.status).toBe(401);
  });
});
