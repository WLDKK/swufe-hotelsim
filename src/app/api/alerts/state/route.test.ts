import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/session", () => ({
  requireApiSession: vi.fn(),
  requireApiRoles: vi.fn(),
}));

vi.mock("@/lib/dal/alerts", () => ({
  listPlatformAlerts: vi.fn(),
}));

vi.mock("@/lib/dal/alert-state", () => ({
  buildAlertActorReference: vi.fn(),
  mutateStoredAlertState: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  recordAuditLog: vi.fn(),
}));

import { POST } from "./route";
import { recordAuditLog } from "@/lib/audit";
import {
  buildAlertActorReference,
  mutateStoredAlertState,
} from "@/lib/dal/alert-state";
import { listPlatformAlerts } from "@/lib/dal/alerts";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";

const mockedRequireApiSession = vi.mocked(requireApiSession);
const mockedRequireApiRoles = vi.mocked(requireApiRoles);
const mockedListPlatformAlerts = vi.mocked(listPlatformAlerts);
const mockedBuildAlertActorReference = vi.mocked(buildAlertActorReference);
const mockedMutateStoredAlertState = vi.mocked(mutateStoredAlertState);
const mockedRecordAuditLog = vi.mocked(recordAuditLog);

describe("/api/alerts/state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireApiSession.mockResolvedValue({
      session: {
        user: {
          id: "admin-1",
          role: "ADMIN",
          email: "admin@hotelsim.example",
          name: "Platform Admin",
        },
      },
    } as Awaited<ReturnType<typeof requireApiSession>>);
    mockedRequireApiRoles.mockReturnValue(null);
    mockedListPlatformAlerts.mockResolvedValue({
      summary: {
        total: 1,
        critical: 1,
        high: 0,
        medium: 0,
        info: 0,
        open: 1,
        acknowledged: 0,
        muted: 0,
        dispatchable: 1,
      },
      alerts: [
        {
          id: "processing:round-1",
          severity: "critical",
          category: "processing",
          title: "Class A round 2 is still processing",
          message: "Round processing is stuck.",
          recommendedAction: "Open class detail.",
          href: "/admin/classes/class-1",
          entityType: "round",
          entityId: "round-1",
          signal: {},
          createdAt: "2026-03-31T00:00:00.000Z",
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
      generatedAt: "2026-03-31T00:00:00.000Z",
      delivery: {
        enabledChannels: [],
        channels: [],
      },
    });
    mockedBuildAlertActorReference.mockReturnValue({
      id: "admin-1",
      email: "admin@hotelsim.example",
      name: "Platform Admin",
      role: "ADMIN",
    });
    mockedMutateStoredAlertState.mockResolvedValue({
      isAcknowledged: true,
      acknowledgedAt: "2026-03-31T00:00:00.000Z",
      acknowledgedBy: {
        id: "admin-1",
        email: "admin@hotelsim.example",
        name: "Platform Admin",
        role: "ADMIN",
      },
      isMuted: false,
      mutedUntil: null,
      mutedBy: null,
    });
  });

  it("acknowledges an active alert for admins", async () => {
    const response = (await POST(
      new NextRequest("http://localhost/api/alerts/state", {
        method: "POST",
        body: JSON.stringify({
          alertId: "processing:round-1",
          action: "acknowledge",
        }),
      })
    ))!;

    expect(response.status).toBe(200);
    expect(mockedMutateStoredAlertState).toHaveBeenCalledWith(
      expect.objectContaining({
        alertId: "processing:round-1",
        action: "acknowledge",
      })
    );
    expect(mockedRecordAuditLog).toHaveBeenCalled();
  });

  it("returns 404 when the requested alert is no longer active", async () => {
    mockedListPlatformAlerts.mockResolvedValue({
      summary: {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        info: 0,
        open: 0,
        acknowledged: 0,
        muted: 0,
        dispatchable: 0,
      },
      alerts: [],
      generatedAt: "2026-03-31T00:00:00.000Z",
      delivery: {
        enabledChannels: [],
        channels: [],
      },
    });

    const response = (await POST(
      new NextRequest("http://localhost/api/alerts/state", {
        method: "POST",
        body: JSON.stringify({
          alertId: "processing:round-1",
          action: "acknowledge",
        }),
      })
    ))!;

    expect(response.status).toBe(404);
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

    const response = (await POST(
      new NextRequest("http://localhost/api/alerts/state", {
        method: "POST",
        body: JSON.stringify({
          alertId: "processing:round-1",
          action: "acknowledge",
        }),
      })
    ))!;

    expect(response.status).toBe(401);
  });
});
