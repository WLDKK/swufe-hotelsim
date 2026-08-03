import { NextRequest } from "next/server";
import { getOptionalSearchParam } from "@/lib/api/requests";
import { apiError, apiSuccess, mapRouteError } from "@/lib/api/responses";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";
import { listRecentAuditLogs } from "@/lib/dal/audit";

export const dynamic = "force-dynamic";

function parseLimit(limitValue: string | null) {
  if (!limitValue) {
    return 10;
  }

  const parsed = Number(limitValue);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }

  return Math.min(Math.trunc(parsed), 50);
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireApiSession();
    if ("response" in authResult) {
      return authResult.response;
    }

    const { session } = authResult;
    const roleError = requireApiRoles(session.user, ["ADMIN"]);
    if (roleError) {
      return roleError;
    }

    const limit = parseLimit(getOptionalSearchParam(request, "limit"));
    if (limit === null) {
      return apiError(400, "The audit log limit must be a positive integer.");
    }

    const action = getOptionalSearchParam(request, "action");
    const entityType = getOptionalSearchParam(request, "entityType");
    const auditLogs = await listRecentAuditLogs({
      limit,
      action: action ?? undefined,
      entityType: entityType ?? undefined,
    });

    return apiSuccess({ auditLogs });
  } catch (error) {
    return mapRouteError(error);
  }
}
