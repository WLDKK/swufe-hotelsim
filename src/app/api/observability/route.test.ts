import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/session", () => ({
  requireApiSession: vi.fn(),
  requireApiRoles: vi.fn(),
}));

vi.mock("@/lib/dal/observability", () => ({
  getPlatformObservabilitySnapshot: vi.fn(),
}));

import { GET } from "./route";
import { getPlatformObservabilitySnapshot } from "@/lib/dal/observability";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";

const mockedRequireApiSession = vi.mocked(requireApiSession);
const mockedRequireApiRoles = vi.mocked(requireApiRoles);
const mockedGetPlatformObservabilitySnapshot = vi.mocked(
  getPlatformObservabilitySnapshot
);

describe("/api/observability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireApiSession.mockResolvedValue({
      session: {
        user: {
          id: "admin-1",
          role: "ADMIN",
        },
      },
    } as Awaited<ReturnType<typeof requireApiSession>>);
    mockedRequireApiRoles.mockReturnValue(null);
  });

  it("returns the current admin observability snapshot", async () => {
    mockedGetPlatformObservabilitySnapshot.mockResolvedValue({
      summary: {
        activeClasses: 2,
        activeProcessingRounds: 0,
        overduePendingRounds: 1,
        classesAwaitingSubmissions: 1,
        missingSubmissions: 2,
        ungradedResults: 3,
        auditEventsLast24Hours: 7,
      },
      roundSignals: [],
      gradingSignals: [],
      auditActions: [],
      generatedAt: "2026-03-30T00:00:00.000Z",
    });

    const response = (await GET(
    ))!;

    expect(response.status).toBe(200);
    expect(mockedGetPlatformObservabilitySnapshot).toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      data: {
        summary: {
          overduePendingRounds: 1,
        },
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
    ))!;

    expect(response.status).toBe(401);
  });
});
