import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/session", () => ({
  requireApiSession: vi.fn(),
  requireApiRoles: vi.fn(),
}));

vi.mock("@/lib/dal/audit", () => ({
  listRecentAuditLogs: vi.fn(),
}));

import { GET } from "./route";
import { listRecentAuditLogs } from "@/lib/dal/audit";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";

const mockedRequireApiSession = vi.mocked(requireApiSession);
const mockedRequireApiRoles = vi.mocked(requireApiRoles);
const mockedListRecentAuditLogs = vi.mocked(listRecentAuditLogs);

describe("/api/audit-logs", () => {
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

  it("lists recent audit logs for admins with capped limit parsing", async () => {
    mockedListRecentAuditLogs.mockResolvedValue([
      {
        id: "audit-1",
        action: "simulation.process",
        entityType: "class",
        entityId: "class-1",
        details: {
          processedRoundNumber: 2,
        },
        ipAddress: "203.0.113.10",
        createdAt: new Date(),
        userId: "teacher-1",
        actor: {
          id: "teacher-1",
          name: "Prof. Chen",
          email: "teacher@hotelsim.example",
          role: "TEACHER",
        },
      },
    ] as Awaited<ReturnType<typeof listRecentAuditLogs>>);

    const response = (await GET(
      new NextRequest("http://localhost/api/audit-logs?limit=99&entityType=class")
    ))!;

    expect(response.status).toBe(200);
    expect(mockedListRecentAuditLogs).toHaveBeenCalledWith({
      limit: 50,
      action: undefined,
      entityType: "class",
    });
  });

  it("rejects invalid limit values before querying the dal", async () => {
    const response = (await GET(
      new NextRequest("http://localhost/api/audit-logs?limit=0")
    ))!;

    expect(response.status).toBe(400);
    expect(mockedListRecentAuditLogs).not.toHaveBeenCalled();
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
      new NextRequest("http://localhost/api/audit-logs")
    ))!;

    expect(response.status).toBe(401);
  });
});
