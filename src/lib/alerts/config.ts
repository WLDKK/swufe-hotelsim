export type AlertDeliveryChannel = "email" | "webhook" | "slack";

export type AlertDeliveryChannelSummary = {
  channel: AlertDeliveryChannel;
  enabled: boolean;
  targetLabel: string | null;
};

export type AlertDeliverySummary = {
  enabledChannels: AlertDeliveryChannel[];
  channels: AlertDeliveryChannelSummary[];
};

function parseRecipients(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((recipient) => recipient.trim())
    .filter((recipient) => recipient.length > 0);
}

function summarizeUrlTarget(rawUrl: string | undefined) {
  if (!rawUrl) {
    return null;
  }

  try {
    return new URL(rawUrl).host;
  } catch {
    return "configured target";
  }
}

export function getAlertEmailRecipients() {
  return parseRecipients(process.env.ALERT_EMAIL_TO);
}

// Keep delivery targets summarized so the admin dashboard can confirm which
// channels are wired without leaking raw secrets or full webhook URLs.
export function getAlertDeliverySummary(): AlertDeliverySummary {
  const emailRecipients = getAlertEmailRecipients();
  const channels: AlertDeliveryChannelSummary[] = [
    {
      channel: "email",
      enabled:
        Boolean(process.env.EMAIL_SERVER) &&
        Boolean(process.env.EMAIL_FROM) &&
        emailRecipients.length > 0,
      targetLabel:
        emailRecipients.length > 0
          ? `${emailRecipients.length} recipient(s)`
          : null,
    },
    {
      channel: "webhook",
      enabled: Boolean(process.env.ALERT_WEBHOOK_URL),
      targetLabel: summarizeUrlTarget(process.env.ALERT_WEBHOOK_URL),
    },
    {
      channel: "slack",
      enabled: Boolean(process.env.ALERT_SLACK_WEBHOOK_URL),
      targetLabel: summarizeUrlTarget(process.env.ALERT_SLACK_WEBHOOK_URL),
    },
  ];

  return {
    enabledChannels: channels
      .filter((channel) => channel.enabled)
      .map((channel) => channel.channel),
    channels,
  };
}
