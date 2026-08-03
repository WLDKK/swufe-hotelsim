import { NextRequest } from "next/server";
import { getOptionalSearchParam } from "@/lib/api/requests";
import { apiError, apiSuccess, mapRouteError } from "@/lib/api/responses";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";
import { listPlatformAlerts } from "@/lib/dal/alerts";

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

function parseBooleanFlag(value: string | null, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }

  if (normalized === "false" || normalized === "0") {
    return false;
  }

  return fallback;
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
      return apiError(400, "The alerts limit must be a positive integer.");
    }

    const alertsSnapshot = await listPlatformAlerts({
      limit,
      includeMuted: parseBooleanFlag(
        getOptionalSearchParam(request, "includeMuted"),
        true
      ),
      includeAcknowledged: parseBooleanFlag(
        getOptionalSearchParam(request, "includeAcknowledged"),
        true
      ),
    });
    return apiSuccess(alertsSnapshot);
  } catch (error) {
    return mapRouteError(error);
  }
}
