import { NextRequest } from "next/server";
import { z } from "zod";
import { recordAuditLog } from "@/lib/audit";
import { revalidateAlertReadModels } from "@/lib/cache-invalidation";
import { getAlertDeliverySummary } from "@/lib/alerts/config";
import { dispatchPlatformAlerts } from "@/lib/alerts/delivery";
import {
  apiError,
  apiSuccess,
  apiValidationError,
  mapRouteError,
} from "@/lib/api/responses";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";

export const dynamic = "force-dynamic";

const alertDeliverSchema = z.object({
  channels: z.array(z.enum(["email", "webhook", "slack"])).optional(),
  minimumSeverity: z.enum(["critical", "high", "medium", "info"]).optional(),
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

    const parsed = alertDeliverSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiValidationError(parsed.error, "The alert delivery request is invalid.");
    }

    const deliverySummary = getAlertDeliverySummary();
    const requestedChannels =
      parsed.data.channels && parsed.data.channels.length > 0
        ? parsed.data.channels
        : deliverySummary.enabledChannels;

    if (requestedChannels.length === 0) {
      return apiError(409, "No external alert delivery channels are configured.");
    }

    const deliveryResult = await dispatchPlatformAlerts({
      channels: requestedChannels,
      minimumSeverity: parsed.data.minimumSeverity ?? "high",
    });

    await recordAuditLog({
      request,
      user: session.user,
      action: "alerts.deliver",
      entityType: "alert_batch",
      entityId: `alerts-${Date.now()}`,
      details: {
        channels: requestedChannels,
        minimumSeverity: parsed.data.minimumSeverity ?? "high",
        alertsDispatched: deliveryResult.alertsDispatched,
        results: deliveryResult.results.map((result) => ({
          channel: result.channel,
          status: result.status,
        })),
      },
    });

    revalidateAlertReadModels();

    return apiSuccess(deliveryResult);
  } catch (error) {
    return mapRouteError(error);
  }
}
