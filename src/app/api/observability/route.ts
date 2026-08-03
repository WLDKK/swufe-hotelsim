import { apiSuccess, mapRouteError } from "@/lib/api/responses";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";
import { getPlatformObservabilitySnapshot } from "@/lib/dal/observability";

export const dynamic = "force-dynamic";

export async function GET() {
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

    const snapshot = await getPlatformObservabilitySnapshot();
    return apiSuccess(snapshot);
  } catch (error) {
    return mapRouteError(error);
  }
}
