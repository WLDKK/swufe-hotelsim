import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { recordAuditLog } from "@/lib/audit";
import prisma from "@/lib/prisma";

const mockedAuditLogCreate = vi.mocked(prisma.auditLog.create);

describe("recordAuditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores a normalized audit payload with the first forwarded ip", async () => {
    await recordAuditLog({
      request: new NextRequest("http://localhost/api/test", {
        headers: {
          "x-forwarded-for": "203.0.113.10, 198.51.100.8",
        },
      }),
      user: {
        id: "admin-1",
      },
      action: "class.create",
      entityType: "class",
      entityId: "class-1",
      details: {
        name: "Hotel Simulation Class A",
        nextRoundNumber: undefined,
        roundProcessedAt: new Date("2026-03-30T00:00:00.000Z"),
        teamNames: ["Team Atlas", undefined, "Team Harbor"],
      },
    });

    expect(mockedAuditLogCreate).toHaveBeenCalledWith({
      data: {
        userId: "admin-1",
        action: "class.create",
        entityType: "class",
        entityId: "class-1",
        ipAddress: "203.0.113.10",
        details: {
          name: "Hotel Simulation Class A",
          roundProcessedAt: "2026-03-30T00:00:00.000Z",
          teamNames: ["Team Atlas", "Team Harbor"],
        },
      },
    });
  });

  it("never throws back to the caller when the audit insert fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedAuditLogCreate.mockRejectedValueOnce(new Error("db down"));

    await expect(
      recordAuditLog({
        request: new NextRequest("http://localhost/api/test"),
        user: {
          id: "admin-1",
        },
        action: "user.create",
        entityType: "user",
        entityId: "user-1",
      })
    ).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
