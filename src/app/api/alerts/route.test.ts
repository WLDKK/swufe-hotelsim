import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/session", () => ({
  requireApiSession: vi.fn(),
  requireApiRoles: vi.fn(),
}));

vi.mock("@/lib/dal/alerts", () => ({
  listPlatformAlerts: vi.fn(),
}));

import { GET } from "./route";
import { listPlatformAlerts } from "@/lib/dal/alerts";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";

const mockedRequireApiSession = vi.mocked(requireApiSession);
const mockedRequireApiRoles = vi.mocked(requireApiRoles);
const mockedListPlatformAlerts = vi.mocked(listPlatformAlerts);

describe("/api/alerts", () => {
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

  it("lists actionable alerts for admins with capped limit parsing", async () => {
    mockedListPlatformAlerts.mockResolvedValue({
      summary: {
        total: 3,
        critical: 1,
        high: 1,
        medium: 1,
        info: 0,
        open: 3,
        acknowledged: 0,
        muted: 0,
        dispatchable: 3,
      },
      alerts: [
        {
          id: "processing:round-1",
          severity: "critical",
          category: "processing",
          title: "Class A round 2 is still processing",
          message: "Round processing is stuck.",
          recommendedAction: "Open class detail and inspect the processing chain.",
          href: "/admin/classes/class-1",
          entityType: "round",
          entityId: "round-1",
          signal: {
            classId: "class-1",
          },
          createdAt: "2026-03-30T00:00:00.000Z",
          state: {
            isAcknowledged: false,
            acknowledgedAt: null,
            acknowledgedBy: null,
            isMuted: false,
            mutedUntil: null,
            mutedBy: null,
          },
          dispatchable: true,
        },
      ],
      generatedAt: "2026-03-30T00:00:00.000Z",
      delivery: {
        enabledChannels: [],
        channels: [],
      },
    });

    const response = (await GET(
      new NextRequest("http://localhost/api/alerts?limit=99")
    ))!;

    expect(response.status).toBe(200);
    expect(mockedListPlatformAlerts).toHaveBeenCalledWith({
      limit: 50,
      includeMuted: true,
      includeAcknowledged: true,
    });
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      data: {
        summary: {
          critical: 1,
        },
      },
    });
  });

  it("rejects invalid limit values before querying the dal", async () => {
    const response = (await GET(
      new NextRequest("http://localhost/api/alerts?limit=0")
    ))!;

    expect(response.status).toBe(400);
    expect(mockedListPlatformAlerts).not.toHaveBeenCalled();
  });

  it("parses explicit false flags without coercing them to true", async () => {
    const response = (await GET(
      new NextRequest(
        "http://localhost/api/alerts?includeMuted=false&includeAcknowledged=0"
      )
    ))!;

    expect(response.status).toBe(200);
    expect(mockedListPlatformAlerts).toHaveBeenCalledWith({
      limit: 10,
      includeMuted: false,
      includeAcknowledged: false,
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
      new NextRequest("http://localhost/api/alerts")
    ))!;

    expect(response.status).toBe(401);
  });
});
