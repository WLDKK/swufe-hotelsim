import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/session", () => ({
  requireApiSession: vi.fn(),
  requireApiRoles: vi.fn(),
}));

vi.mock("@/lib/alerts/config", () => ({
  getAlertDeliverySummary: vi.fn(),
}));

vi.mock("@/lib/alerts/delivery", () => ({
  dispatchPlatformAlerts: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  recordAuditLog: vi.fn(),
}));

import { POST } from "./route";
import { recordAuditLog } from "@/lib/audit";
import { getAlertDeliverySummary } from "@/lib/alerts/config";
import { dispatchPlatformAlerts } from "@/lib/alerts/delivery";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";

const mockedRequireApiSession = vi.mocked(requireApiSession);
const mockedRequireApiRoles = vi.mocked(requireApiRoles);
const mockedGetAlertDeliverySummary = vi.mocked(getAlertDeliverySummary);
const mockedDispatchPlatformAlerts = vi.mocked(dispatchPlatformAlerts);
const mockedRecordAuditLog = vi.mocked(recordAuditLog);

describe("/api/alerts/deliver", () => {
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
    mockedGetAlertDeliverySummary.mockReturnValue({
      enabledChannels: ["webhook"],
      channels: [
        {
          channel: "webhook",
          enabled: true,
          targetLabel: "ops.example.com",
        },
      ],
    });
    mockedDispatchPlatformAlerts.mockResolvedValue({
      minimumSeverity: "high",
      alertsDispatched: 2,
      generatedAt: "2026-03-31T00:00:00.000Z",
      results: [
        {
          channel: "webhook",
          status: "sent",
          targetLabel: "ops.example.com",
          message: "Webhook alert digest delivered.",
        },
      ],
    });
  });

  it("dispatches high-severity alerts for admins", async () => {
    const response = (await POST(
      new NextRequest("http://localhost/api/alerts/deliver", {
        method: "POST",
        body: JSON.stringify({
          minimumSeverity: "high",
        }),
      })
    ))!;

    expect(response.status).toBe(200);
    expect(mockedDispatchPlatformAlerts).toHaveBeenCalledWith({
      channels: ["webhook"],
      minimumSeverity: "high",
    });
    expect(mockedRecordAuditLog).toHaveBeenCalled();
  });

  it("returns 409 when no channels are configured", async () => {
    mockedGetAlertDeliverySummary.mockReturnValue({
      enabledChannels: [],
      channels: [],
    });

    const response = (await POST(
      new NextRequest("http://localhost/api/alerts/deliver", {
        method: "POST",
        body: JSON.stringify({}),
      })
    ))!;

    expect(response.status).toBe(409);
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
      new NextRequest("http://localhost/api/alerts/deliver", {
        method: "POST",
        body: JSON.stringify({}),
      })
    ))!;

    expect(response.status).toBe(401);
  });
});
