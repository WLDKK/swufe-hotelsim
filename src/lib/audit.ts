import type { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import type { ApiSessionUser } from "@/lib/api/session";
import prisma from "@/lib/prisma";

type AuditLogInput = {
  request: Pick<NextRequest, "headers">;
  user: Pick<ApiSessionUser, "id">;
  action: string;
  entityType: string;
  entityId: string;
  details?: unknown;
};

function getRequestIpAddress(request: Pick<NextRequest, "headers">) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return request.headers.get("x-real-ip")?.trim() || null;
}

function normalizeAuditValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return undefined;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeAuditValue(item))
      .filter((item): item is Prisma.InputJsonValue => item !== undefined);
  }

  if (typeof value === "object") {
    const entries = Object.entries(value)
      .map(([key, entryValue]) => [key, normalizeAuditValue(entryValue)] as const)
      .filter((entry): entry is readonly [string, Prisma.InputJsonValue] => {
        return entry[1] !== undefined;
      });

    return Object.fromEntries(entries);
  }

  return String(value);
}

export async function recordAuditLog({
  request,
  user,
  action,
  entityType,
  entityId,
  details,
}: AuditLogInput) {
  try {
    const normalizedDetails =
      details === undefined ? undefined : normalizeAuditValue(details);

    // Audit logging is intentionally best-effort. High-value admin/teacher
    // actions should leave a trail when possible, but a logging failure should
    // not roll back the primary business mutation that the operator just made.
    await prisma.auditLog.create({
      data: {
        userId: user.id ?? null,
        action,
        entityType,
        entityId,
        ipAddress: getRequestIpAddress(request),
        // Callers should pass a curated summary here rather than raw request
        // payloads so secrets like passwords never land in the audit table.
        ...(normalizedDetails === undefined ? {} : { details: normalizedDetails }),
      },
    });
  } catch (error) {
    console.error("Failed to persist audit log.", error);
  }
}
