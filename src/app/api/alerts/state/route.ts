import { NextRequest } from "next/server";
import { z } from "zod";
import { recordAuditLog } from "@/lib/audit";
import { revalidateAlertReadModels } from "@/lib/cache-invalidation";
import {
  buildAlertActorReference,
  mutateStoredAlertState,
} from "@/lib/dal/alert-state";
import { listPlatformAlerts } from "@/lib/dal/alerts";
import {
  apiError,
  apiSuccess,
  apiValidationError,
  mapRouteError,
} from "@/lib/api/responses";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";

export const dynamic = "force-dynamic";

const alertStateMutationSchema = z.object({
  alertId: z.string().trim().min(1),
  action: z.enum(["acknowledge", "unacknowledge", "mute", "unmute"]),
  muteHours: z.number().int().min(1).max(24 * 14).optional(),
});

export async function POST(request: NextRequest) {
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

    const parsed = alertStateMutationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiValidationError(parsed.error, "The alert state request is invalid.");
    }

    const snapshot = await listPlatformAlerts();
    const alert = snapshot.alerts.find(
      (currentAlert) => currentAlert.id === parsed.data.alertId
    );

    if (!alert) {
      return apiError(404, "The selected alert is no longer active.");
    }

    const mutedUntil =
      parsed.data.action === "mute"
        ? new Date(
            Date.now() + (parsed.data.muteHours ?? 24) * 60 * 60 * 1000
          ).toISOString()
        : null;

    const state = await mutateStoredAlertState({
      alertId: parsed.data.alertId,
      action: parsed.data.action,
      actor: buildAlertActorReference(session.user),
      mutedUntil,
    });

    await recordAuditLog({
      request,
      user: session.user,
      action: `alerts.${parsed.data.action}`,
      entityType: "alert",
      entityId: parsed.data.alertId,
      details: {
        mutedUntil,
      },
    });

    revalidateAlertReadModels();

    return apiSuccess({
      alertId: parsed.data.alertId,
      state,
    });
  } catch (error) {
    return mapRouteError(error);
  }
}
