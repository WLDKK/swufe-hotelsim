import { cacheQuery, cacheTags } from "@/lib/cache";
import { getAlertDeliverySummary } from "@/lib/alerts/config";
import {
  getStoredAlertStateMap,
  hydratePlatformAlertState,
  type PlatformAlertState,
} from "@/lib/dal/alert-state";
import { getPlatformObservabilitySnapshot } from "@/lib/dal/observability";

export type PlatformAlertSeverity = "critical" | "high" | "medium" | "info";
export type PlatformAlertCategory =
  | "processing"
  | "submission"
  | "grading"
  | "activity";

export type PlatformAlert = {
  id: string;
  severity: PlatformAlertSeverity;
  category: PlatformAlertCategory;
  title: string;
  message: string;
  recommendedAction: string;
  href: string;
  entityType: "platform" | "class" | "round";
  entityId: string;
  signal: Record<string, unknown>;
  createdAt: string;
  state: PlatformAlertState;
  dispatchable: boolean;
};

export type PlatformAlertsSnapshot = {
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    info: number;
    open: number;
    acknowledged: number;
    muted: number;
    dispatchable: number;
  };
  alerts: PlatformAlert[];
  generatedAt: string;
  delivery?: ReturnType<typeof getAlertDeliverySummary>;
};

type ObservabilitySnapshot = Awaited<
  ReturnType<typeof getPlatformObservabilitySnapshot>
>;

type BuildPlatformAlertsOptions = {
  limit?: number;
  includeMuted?: boolean;
  includeAcknowledged?: boolean;
};

const severityRank: Record<PlatformAlertSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  info: 3,
};

const categoryRank: Record<PlatformAlertCategory, number> = {
  processing: 0,
  submission: 1,
  grading: 2,
  activity: 3,
};

function getAlertTimestamp(alert: PlatformAlert) {
  const timestamp = new Date(alert.createdAt).getTime();
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

function compareAlerts(left: PlatformAlert, right: PlatformAlert) {
  if (severityRank[left.severity] !== severityRank[right.severity]) {
    return severityRank[left.severity] - severityRank[right.severity];
  }

  if (categoryRank[left.category] !== categoryRank[right.category]) {
    return categoryRank[left.category] - categoryRank[right.category];
  }

  const leftTimestamp = getAlertTimestamp(left);
  const rightTimestamp = getAlertTimestamp(right);
  if (leftTimestamp !== rightTimestamp) {
    return leftTimestamp - rightTimestamp;
  }

  return left.title.localeCompare(right.title, "en", {
    sensitivity: "base",
  });
}

function clampLimit(limit: number | undefined) {
  if (!Number.isFinite(limit)) {
    return undefined;
  }

  return Math.max(1, Math.trunc(limit!));
}

function toIsoString(value: Date | string | null | undefined, fallback: string) {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }

  return fallback;
}

// Keep the alert derivation pure and data-only so the dashboard, API layer,
// and any future delivery channel can share one severity model.
export function buildPlatformAlerts(
  snapshot: ObservabilitySnapshot,
  options: BuildPlatformAlertsOptions = {}
): PlatformAlertsSnapshot {
  const alerts: PlatformAlert[] = [];

  for (const signal of snapshot.roundSignals) {
    if (signal.roundStatus === "PROCESSING") {
      alerts.push({
        id: `processing:${signal.roundId}`,
        severity: "critical",
        category: "processing",
        title: `${signal.className} round ${signal.roundNumber} is still processing`,
        message:
          "The round is still marked PROCESSING after the teacher-triggered run path returned. This usually means the processing chain did not finish cleanly.",
        recommendedAction:
          "Open the class detail page, confirm the current round state, and investigate whether the processing route or downstream persistence needs to be retried.",
        href: `/admin/classes/${signal.classId}`,
        entityType: "round",
        entityId: signal.roundId,
        signal: {
          classId: signal.classId,
          className: signal.className,
          roundNumber: signal.roundNumber,
          roundStatus: signal.roundStatus,
          submittedTeams: signal.submittedTeams,
          totalTeams: signal.totalTeams,
        },
        createdAt: toIsoString(signal.openedAt, snapshot.generatedAt),
        state: {
          isAcknowledged: false,
          acknowledgedAt: null,
          acknowledgedBy: null,
          isMuted: false,
          mutedUntil: null,
          mutedBy: null,
        },
        dispatchable: true,
      });
      continue;
    }

    if (signal.overdue && signal.missingTeams > 0) {
      alerts.push({
        id: `submission-overdue:${signal.roundId}`,
        severity: "high",
        category: "submission",
        title: `${signal.className} round ${signal.roundNumber} is overdue`,
        message: `${signal.missingTeams} of ${signal.totalTeams} teams still have not submitted after the round deadline.`,
        recommendedAction:
          "Open the class detail page, follow up with the missing teams, and either extend the deadline or hold processing until the class is operationally ready.",
        href: `/admin/classes/${signal.classId}`,
        entityType: "round",
        entityId: signal.roundId,
        signal: {
          classId: signal.classId,
          className: signal.className,
          roundNumber: signal.roundNumber,
          missingTeams: signal.missingTeams,
          submittedTeams: signal.submittedTeams,
          totalTeams: signal.totalTeams,
          deadline: signal.deadline,
        },
        createdAt: toIsoString(signal.deadline, snapshot.generatedAt),
        state: {
          isAcknowledged: false,
          acknowledgedAt: null,
          acknowledgedBy: null,
          isMuted: false,
          mutedUntil: null,
          mutedBy: null,
        },
        dispatchable: true,
      });
      continue;
    }

    if (signal.missingTeams > 0) {
      alerts.push({
        id: `submission-pending:${signal.roundId}`,
        severity: "medium",
        category: "submission",
        title: `${signal.className} round ${signal.roundNumber} still needs submissions`,
        message: `${signal.missingTeams} of ${signal.totalTeams} teams are still pending for the current decision round.`,
        recommendedAction:
          signal.deadline !== null
            ? "Monitor the class detail page and nudge the remaining team leaders before the configured deadline passes."
            : "Review the class detail page, confirm the round deadline is clear to students, and follow up with the remaining team leaders.",
        href: `/admin/classes/${signal.classId}`,
        entityType: "round",
        entityId: signal.roundId,
        signal: {
          classId: signal.classId,
          className: signal.className,
          roundNumber: signal.roundNumber,
          missingTeams: signal.missingTeams,
          submittedTeams: signal.submittedTeams,
          totalTeams: signal.totalTeams,
          deadline: signal.deadline,
        },
        createdAt: toIsoString(signal.deadline, snapshot.generatedAt),
        state: {
          isAcknowledged: false,
          acknowledgedAt: null,
          acknowledgedBy: null,
          isMuted: false,
          mutedUntil: null,
          mutedBy: null,
        },
        dispatchable: true,
      });
    }
  }

  for (const signal of snapshot.gradingSignals) {
    alerts.push({
      id: `grading:${signal.classId}`,
      severity: "medium",
      category: "grading",
      title: `${signal.className} has ungraded results`,
      message: `${signal.ungradedResults} processed result rows are still missing teacher scores or comments. Latest pending round: ${signal.latestUngradedRound}.`,
      recommendedAction:
        "Open the class detail page and clear the grading backlog so students can review complete teacher feedback.",
      href: `/admin/classes/${signal.classId}`,
      entityType: "class",
      entityId: signal.classId,
      signal: {
        classId: signal.classId,
        className: signal.className,
        ungradedResults: signal.ungradedResults,
        latestUngradedRound: signal.latestUngradedRound,
      },
      createdAt: snapshot.generatedAt,
      state: {
        isAcknowledged: false,
        acknowledgedAt: null,
        acknowledgedBy: null,
        isMuted: false,
        mutedUntil: null,
        mutedBy: null,
      },
      dispatchable: true,
    });
  }

  if (
    snapshot.summary.activeClasses > 0 &&
    snapshot.summary.auditEventsLast24Hours === 0
  ) {
    alerts.push({
      id: "activity:quiet-platform",
      severity: "info",
      category: "activity",
      title: "No operator activity recorded in the last 24 hours",
      message: `${snapshot.summary.activeClasses} active classes remain on the platform, but no admin or teacher audit events were captured in the last 24 hours.`,
      recommendedAction:
        "Confirm an operator is still watching the active cohorts and verify whether the audit feed is unexpectedly quiet or the teaching schedule is intentionally idle.",
      href: "/admin/dashboard",
      entityType: "platform",
      entityId: "operations",
      signal: {
        activeClasses: snapshot.summary.activeClasses,
        auditEventsLast24Hours: snapshot.summary.auditEventsLast24Hours,
      },
      createdAt: snapshot.generatedAt,
      state: {
        isAcknowledged: false,
        acknowledgedAt: null,
        acknowledgedBy: null,
        isMuted: false,
        mutedUntil: null,
        mutedBy: null,
      },
      dispatchable: true,
    });
  }

  const summary = alerts.reduce<PlatformAlertsSnapshot["summary"]>(
    (counts, alert) => {
      counts.total += 1;
      counts[alert.severity] += 1;
      counts.open += 1;
      counts.dispatchable += 1;
      return counts;
    },
    {
      total: 0,
      critical: 0,
      high: 0,
      medium: 0,
      info: 0,
      open: 0,
      acknowledged: 0,
      muted: 0,
      dispatchable: 0,
    }
  );

  const sortedAlerts = [...alerts].sort(compareAlerts);
  const limit = clampLimit(options.limit);

  return {
    summary,
    alerts: typeof limit === "number" ? sortedAlerts.slice(0, limit) : sortedAlerts,
    generatedAt: snapshot.generatedAt,
  };
}

export async function listPlatformAlerts(
  options: BuildPlatformAlertsOptions = {}
) {
  const includeMuted = options.includeMuted ?? true;
  const includeAcknowledged = options.includeAcknowledged ?? true;

  return cacheQuery(
    [
      "alerts",
      "platform",
      options.limit ?? "all",
      includeMuted,
      includeAcknowledged,
    ],
    async () => {
      const snapshot = await getPlatformObservabilitySnapshot();
      const baseSnapshot = buildPlatformAlerts(snapshot);
      const storedStates = await getStoredAlertStateMap();
      const now = new Date();

      const enrichedAlerts = baseSnapshot.alerts.map((alert) => {
        const state = hydratePlatformAlertState(storedStates[alert.id], now);
        const dispatchable = !state.isAcknowledged && !state.isMuted;

        return {
          ...alert,
          state,
          dispatchable,
        };
      });

      const summary = enrichedAlerts.reduce<PlatformAlertsSnapshot["summary"]>(
        (counts, alert) => {
          counts.total += 1;
          counts[alert.severity] += 1;

          if (alert.state.isAcknowledged) {
            counts.acknowledged += 1;
          } else {
            counts.open += 1;
          }

          if (alert.state.isMuted) {
            counts.muted += 1;
          }

          if (alert.dispatchable) {
            counts.dispatchable += 1;
          }

          return counts;
        },
        {
          total: 0,
          critical: 0,
          high: 0,
          medium: 0,
          info: 0,
          open: 0,
          acknowledged: 0,
          muted: 0,
          dispatchable: 0,
        }
      );

      const filteredAlerts = enrichedAlerts.filter((alert) => {
        if (!includeMuted && alert.state.isMuted) {
          return false;
        }

        if (!includeAcknowledged && alert.state.isAcknowledged) {
          return false;
        }

        return true;
      });
      const limit = clampLimit(options.limit);

      return {
        summary,
        alerts:
          typeof limit === "number" ? filteredAlerts.slice(0, limit) : filteredAlerts,
        generatedAt: baseSnapshot.generatedAt,
        delivery: getAlertDeliverySummary(),
      } satisfies PlatformAlertsSnapshot;
    },
    {
      tags: [cacheTags.alerts, cacheTags.observability, cacheTags.audit],
    }
  );
}
