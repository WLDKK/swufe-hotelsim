import nodemailer from "nodemailer";
import {
  getAlertDeliverySummary,
  getAlertEmailRecipients,
  type AlertDeliveryChannel,
} from "@/lib/alerts/config";
import {
  listPlatformAlerts,
  type PlatformAlert,
  type PlatformAlertSeverity,
} from "@/lib/dal/alerts";
import { toAbsoluteAppUrl } from "@/lib/site-url";

const severityRank: Record<PlatformAlertSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  info: 3,
};

export type AlertDeliveryResult = {
  channel: AlertDeliveryChannel;
  status: "sent" | "skipped" | "failed";
  targetLabel: string | null;
  message: string;
};

export type DispatchPlatformAlertsResult = {
  minimumSeverity: PlatformAlertSeverity;
  alertsDispatched: number;
  results: AlertDeliveryResult[];
  generatedAt: string;
};

function buildAlertDigestSubject(
  minimumSeverity: PlatformAlertSeverity,
  alertCount: number
) {
  return `[SWUFE HotelSim] ${alertCount} ${minimumSeverity}+ alert(s) require attention`;
}

function getAbsoluteAlertHref(href: string) {
  return toAbsoluteAppUrl(href);
}

function buildAlertDigestText(
  alerts: PlatformAlert[],
  minimumSeverity: PlatformAlertSeverity
) {
  return [
    `SWUFE HotelSim external alert digest`,
    `Minimum severity: ${minimumSeverity}`,
    `Generated at: ${new Date().toISOString()}`,
    "",
    ...alerts.flatMap((alert, index) => [
      `${index + 1}. [${alert.severity.toUpperCase()}] ${alert.title}`,
      `Category: ${alert.category}`,
      `Message: ${alert.message}`,
      `Recommended action: ${alert.recommendedAction}`,
      `Open: ${getAbsoluteAlertHref(alert.href)}`,
      "",
    ]),
  ].join("\n");
}

async function deliverEmailAlertDigest(input: {
  alerts: PlatformAlert[];
  minimumSeverity: PlatformAlertSeverity;
}) {
  const recipients = getAlertEmailRecipients();

  if (
    !process.env.EMAIL_SERVER ||
    !process.env.EMAIL_FROM ||
    recipients.length === 0
  ) {
    return {
      channel: "email",
      status: "skipped",
      targetLabel:
        recipients.length > 0 ? `${recipients.length} recipient(s)` : null,
      message: "Email delivery is not fully configured.",
    } satisfies AlertDeliveryResult;
  }

  const transporter = nodemailer.createTransport(process.env.EMAIL_SERVER);
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: recipients.join(", "),
    subject: buildAlertDigestSubject(
      input.minimumSeverity,
      input.alerts.length
    ),
    text: buildAlertDigestText(input.alerts, input.minimumSeverity),
  });

  return {
    channel: "email",
    status: "sent",
    targetLabel: `${recipients.length} recipient(s)`,
    message: "Email alert digest delivered.",
  } satisfies AlertDeliveryResult;
}

async function deliverWebhookAlertDigest(input: {
  alerts: PlatformAlert[];
  minimumSeverity: PlatformAlertSeverity;
}) {
  if (!process.env.ALERT_WEBHOOK_URL) {
    return {
      channel: "webhook",
      status: "skipped",
      targetLabel: null,
      message: "Webhook delivery is not configured.",
    } satisfies AlertDeliveryResult;
  }

  const response = await fetch(process.env.ALERT_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.ALERT_WEBHOOK_BEARER_TOKEN
        ? {
            Authorization: `Bearer ${process.env.ALERT_WEBHOOK_BEARER_TOKEN}`,
          }
        : {}),
    },
    body: JSON.stringify({
      source: "swufe-hotelsim",
      generatedAt: new Date().toISOString(),
      minimumSeverity: input.minimumSeverity,
      alerts: input.alerts.map((alert) => ({
        ...alert,
        href: getAbsoluteAlertHref(alert.href),
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Webhook delivery failed with status ${response.status}.`);
  }

  return {
    channel: "webhook",
    status: "sent",
    targetLabel: new URL(process.env.ALERT_WEBHOOK_URL).host,
    message: "Webhook alert digest delivered.",
  } satisfies AlertDeliveryResult;
}

async function deliverSlackAlertDigest(input: {
  alerts: PlatformAlert[];
  minimumSeverity: PlatformAlertSeverity;
}) {
  if (!process.env.ALERT_SLACK_WEBHOOK_URL) {
    return {
      channel: "slack",
      status: "skipped",
      targetLabel: null,
      message: "Slack delivery is not configured.",
    } satisfies AlertDeliveryResult;
  }

  const response = await fetch(process.env.ALERT_SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: buildAlertDigestSubject(input.minimumSeverity, input.alerts.length),
      blocks: input.alerts.flatMap((alert) => [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${alert.title}* \nSeverity: ${alert.severity} | Category: ${alert.category}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${alert.message}\nNext: ${alert.recommendedAction}\n<${getAbsoluteAlertHref(alert.href)}|Open action>`,
          },
        },
        {
          type: "divider",
        },
      ]),
    }),
  });

  if (!response.ok) {
    throw new Error(`Slack delivery failed with status ${response.status}.`);
  }

  return {
    channel: "slack",
    status: "sent",
    targetLabel: new URL(process.env.ALERT_SLACK_WEBHOOK_URL).host,
    message: "Slack alert digest delivered.",
  } satisfies AlertDeliveryResult;
}

export async function dispatchPlatformAlerts(options: {
  channels?: AlertDeliveryChannel[];
  minimumSeverity?: PlatformAlertSeverity;
} = {}): Promise<DispatchPlatformAlertsResult> {
  const minimumSeverity = options.minimumSeverity ?? "high";
  const snapshot = await listPlatformAlerts({
    includeAcknowledged: false,
    includeMuted: false,
  });
  const alerts = snapshot.alerts.filter(
    (alert) => severityRank[alert.severity] <= severityRank[minimumSeverity]
  );
  const deliverySummary = getAlertDeliverySummary();
  const requestedChannels =
    options.channels && options.channels.length > 0
      ? options.channels
      : deliverySummary.enabledChannels;

  if (alerts.length === 0) {
    return {
      minimumSeverity,
      alertsDispatched: 0,
      generatedAt: snapshot.generatedAt,
      results: requestedChannels.map((channel) => ({
        channel,
        status: "skipped",
        targetLabel:
          deliverySummary.channels.find((item) => item.channel === channel)?.targetLabel ??
          null,
        message: "No dispatchable alerts match the selected severity threshold.",
      })),
    };
  }

  const results: AlertDeliveryResult[] = [];

  for (const channel of requestedChannels) {
    try {
      switch (channel) {
        case "email":
          results.push(
            await deliverEmailAlertDigest({
              alerts,
              minimumSeverity,
            })
          );
          break;
        case "webhook":
          results.push(
            await deliverWebhookAlertDigest({
              alerts,
              minimumSeverity,
            })
          );
          break;
        case "slack":
          results.push(
            await deliverSlackAlertDigest({
              alerts,
              minimumSeverity,
            })
          );
          break;
      }
    } catch (error) {
      results.push({
        channel,
        status: "failed",
        targetLabel:
          deliverySummary.channels.find((item) => item.channel === channel)?.targetLabel ??
          null,
        message: error instanceof Error ? error.message : "Alert delivery failed.",
      });
    }
  }

  return {
    minimumSeverity,
    alertsDispatched: alerts.length,
    results,
    generatedAt: snapshot.generatedAt,
  };
}
