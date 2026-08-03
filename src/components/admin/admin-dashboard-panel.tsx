"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Loader2 } from "lucide-react";
import { AdminWorkspaceHero } from "@/components/admin/admin-workspace-hero";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getClassStatusLabel,
  getRoundStatusLabel,
  getSemesterStatusLabel,
  getUserRoleLabel,
} from "@/i18n/status-labels";
import { useLocale } from "@/i18n/use-locale";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

type PlatformUser = {
  id: string;
  name: string | null;
  email: string;
  role: "STUDENT" | "TEACHER" | "JUDGE" | "SPECTATOR" | "ADMIN";
  studentId: string | null;
  _count: {
    teamMembers: number;
    createdSemesters: number;
  };
};

type UsersResponse = {
  users: PlatformUser[];
};

type SemesterListItem = {
  id: string;
  name: string;
  code: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  creator: {
    id: string;
    name: string | null;
    email: string;
    role: "TEACHER" | "JUDGE" | "ADMIN";
  };
  _count: {
    classes: number;
  };
  classes: Array<{
    id: string;
    name: string;
    status: string;
    currentRound: number;
    maxRounds: number;
  }>;
};

type SemestersResponse = {
  semesters: SemesterListItem[];
};

type ClassListItem = {
  id: string;
  name: string;
  joinCode: string;
  status: string;
  currentRound: number;
  maxRounds: number;
  maxTeams: number;
  semester: {
    id: string;
    name: string;
    code: string;
    creator: {
      id: string;
      name: string | null;
      email: string;
      role: "TEACHER" | "JUDGE" | "ADMIN";
    };
  };
  _count: {
    teams: number;
    teamMembers: number;
    rounds: number;
  };
};

type ClassesResponse = {
  classes: ClassListItem[];
};

type AuditLogItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: unknown;
  ipAddress: string | null;
  createdAt: string;
  actor: {
    id: string;
    name: string | null;
    email: string;
    role: "TEACHER" | "JUDGE" | "ADMIN" | "SPECTATOR" | "STUDENT";
  } | null;
};

type AuditLogsResponse = {
  auditLogs: AuditLogItem[];
};

type PlatformAlertSeverity = "critical" | "high" | "medium" | "info";
type PlatformAlertCategory =
  | "processing"
  | "submission"
  | "grading"
  | "activity";
type AlertDeliveryChannel = "email" | "webhook" | "slack";

type AlertActorReference = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
};

type PlatformAlertState = {
  isAcknowledged: boolean;
  acknowledgedAt: string | null;
  acknowledgedBy: AlertActorReference | null;
  isMuted: boolean;
  mutedUntil: string | null;
  mutedBy: AlertActorReference | null;
};

type AlertDeliveryChannelSummary = {
  channel: AlertDeliveryChannel;
  enabled: boolean;
  targetLabel: string | null;
};

type PlatformAlertItem = {
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

type AlertsResponse = {
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
  alerts: PlatformAlertItem[];
  generatedAt: string;
  delivery?: {
    enabledChannels: AlertDeliveryChannel[];
    channels: AlertDeliveryChannelSummary[];
  };
};

type AlertStateMutationResponse = {
  alertId: string;
  state: PlatformAlertState;
};

type AlertDeliveryMutationResponse = {
  minimumSeverity: PlatformAlertSeverity;
  alertsDispatched: number;
  generatedAt: string;
  results: Array<{
    channel: AlertDeliveryChannel;
    status: "sent" | "skipped" | "failed";
    targetLabel: string | null;
    message: string;
  }>;
};

type ObservabilitySnapshot = {
  summary: {
    activeClasses: number;
    activeProcessingRounds: number;
    overduePendingRounds: number;
    classesAwaitingSubmissions: number;
    missingSubmissions: number;
    ungradedResults: number;
    auditEventsLast24Hours: number;
  };
  roundSignals: Array<{
    classId: string;
    className: string;
    classStatus: string;
    roundId: string;
    roundNumber: number;
    roundStatus: "PENDING" | "PROCESSING";
    deadline: string | null;
    openedAt: string;
    totalTeams: number;
    submittedTeams: number;
    missingTeams: number;
    overdue: boolean;
  }>;
  gradingSignals: Array<{
    classId: string;
    className: string;
    ungradedResults: number;
    latestUngradedRound: number;
  }>;
  auditActions: Array<{
    action: string;
    count: number;
  }>;
  generatedAt: string;
};

type AdminDashboardPanelProps = {
  initialClassId?: string;
};

function formatAuditActionLabel(locale: "zh-CN" | "en-US", action: string) {
  return auditActionLabels[locale][action as keyof (typeof auditActionLabels)["zh-CN"]]
    ?? formatTokenLabel(action);
}

function formatTokenLabel(value: string) {
  return value
    .split(/[^a-zA-Z0-9]+/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

const alertSeverityLabels = {
  "zh-CN": {
    critical: "严重",
    high: "高",
    medium: "中",
    info: "信息",
  },
  "en-US": {
    critical: "Critical",
    high: "High",
    medium: "Medium",
    info: "Info",
  },
} as const;

const alertCategoryLabels = {
  "zh-CN": {
    processing: "处理",
    submission: "提交",
    grading: "评分",
    activity: "活动",
  },
  "en-US": {
    processing: "Processing",
    submission: "Submission",
    grading: "Grading",
    activity: "Activity",
  },
} as const;

const alertChannelLabels = {
  "zh-CN": {
    email: "邮件",
    webhook: "Webhook",
    slack: "Slack",
  },
  "en-US": {
    email: "Email",
    webhook: "Webhook",
    slack: "Slack",
  },
} as const;

const auditActionLabels = {
  "zh-CN": {
    "user.role.update": "用户角色调整",
    "team.create": "创建队伍",
    "roster.csv.apply": "导入名册 CSV",
    "simulation.process": "处理模拟轮次",
    "grading.save": "保存评分",
  },
  "en-US": {
    "user.role.update": "User role update",
    "team.create": "Team created",
    "roster.csv.apply": "Roster CSV apply",
    "simulation.process": "Simulation process",
    "grading.save": "Grading save",
  },
} as const;

const entityTypeLabels = {
  "zh-CN": {
    platform: "平台",
    class: "班级",
    round: "轮次",
  },
  "en-US": {
    platform: "Platform",
    class: "Class",
    round: "Round",
  },
} as const;

// The admin dashboard blends observability, audit, alerting, and business
// oversight. Keeping this chrome copy page-local makes Stage 7 handoff easier
// because operators can adjust one surface without expanding the shared
// dictionary with a large monitoring-specific subtree.
const adminDashboardCopy = {
  "zh-CN": {
    hero: {
      badgeLabel: "管理 / 总览",
      title: "平台用户、学期与实时班级总览",
      description:
        "这个管理总览直接汇总平台用户、学期与班级数据，因此运维观察与日常操作始终保持对齐。",
      statusTitle: "平台就绪度",
      statusBodySelected: (className: string) =>
        `${className} 已被设为当前聚焦班级，管理端在浏览用户、学期与班级时都能持续盯住这条活跃业务链。`,
      statusBodyDefault:
        "用户、学期与班级计数都来自同一套管理数据，因此这里看到的平台视图与其它管理页面保持一致。",
      summaryLabels: {
        users: "用户",
        semesters: "学期",
        classes: "班级",
        assigned: "已分配",
      },
      summaryHints: {
        users: (teachers: number, students: number) => `教师 ${teachers} | 学生 ${students}`,
        semesters: (activeSemesters: number, admins: number) =>
          `进行中 ${activeSemesters} | 管理员 ${admins}`,
        classes: (activeClasses: number, setupClasses: number) =>
          `进行中 ${activeClasses} | 待配置 ${setupClasses}`,
        assigned: "已加入队伍的学生数。",
      },
      actions: {
        users: "打开用户",
        semesters: "打开学期",
        classes: "打开班级",
        spotlight: "打开聚焦班级",
        detail: "打开班级详情",
      },
    },
    loading: "正在加载平台总览数据...",
    loadError: "管理总览加载失败。",
    platformMix: {
      title: "平台构成",
      description:
        "这些高频总数被单独保留在 hero 外部，方便管理端在继续看下方归属与聚焦区块时，始终保持稠密的运营快照。",
      cards: {
        users: "用户",
        semesters: "学期",
        classes: "班级",
        assignments: "分配情况",
        usersHint: (teachers: number, students: number) => `教师 ${teachers} | 学生 ${students}`,
        semestersHint: (activeSemesters: number) => `进行中 ${activeSemesters}`,
        classesHint: (activeClasses: number, setupClasses: number) =>
          `进行中 ${activeClasses} | 待配置 ${setupClasses}`,
        assignmentsHint: "已加入队伍的学生",
      },
    },
    alerts: {
      title: "可执行告警",
      description:
        "这些衍生告警把底层 observability 信号转成按严重级别排序的下一步动作，让管理端能直接从发现跳到对应业务页。",
      loading: "正在加载可执行告警...",
      loadError: "可执行告警流加载失败。",
      notices: {
        acknowledged: "告警已确认，仍会保留在列表中供后续跟进。",
        reopened: "告警已重新打开，可参与下一次站外投递。",
        muted: (muteHours: number) => `告警已静默 ${muteHours} 小时。`,
        unmuted: "告警静默已解除，信号重新生效。",
        stateFailed: "告警状态更新失败。",
        noDispatchable: (minimumSeverity: string) =>
          `当前没有可投递的 ${minimumSeverity}+ 告警，本次投递已安全跳过。`,
        dispatched: (count: number, minimumSeverity: string, sentCount: number, failedCount: number) =>
          `已向 ${sentCount} 个通道投递 ${count} 条 ${minimumSeverity}+ 告警${failedCount > 0 ? `，其中 ${failedCount} 次通道尝试失败` : ""}。`,
        deliveryFailed: "站外告警投递失败。",
      },
      summary: {
        totalSignals: "总信号数",
        showingCount: (count: number) => `当前仪表盘展示 ${count} 条`,
        openAlerts: "未处理告警",
        notAcknowledged: "尚未确认",
        acknowledged: "已确认",
        acknowledgedHint: "暂由运营人员接手处理中",
        muted: "已静默",
        mutedHint: "静默期内不会触发主动告警",
        dispatchable: "可投递",
        dispatchableHint: "符合站外告警投递条件",
        delivery: "投递通道",
        deliveryHint: (enabledCount: number, totalCount: number) =>
          `${enabledCount} / ${totalCount} 个已启用`,
      },
      deliveryPanel: {
        title: "站外投递",
        description:
          "已确认或已静默的告警不会参与站外提醒。下方动作会把当前 high 及以上摘要投递到所有启用通道，UI 不会暴露原始密钥。",
        noChannels: "尚未配置任何投递通道",
        disabledSuffix: "未启用",
        severityBreakdown: {
          critical: "严重",
          high: "高",
          medium: "中",
          info: "信息",
        },
        dispatchButton: "投递高优先级告警",
        refreshButton: "刷新告警流",
        enabledTargets: (targets: string) => `已启用目标：${targets}。`,
        configureHint:
          "配置 `EMAIL_SERVER` / `ALERT_EMAIL_TO`、`ALERT_WEBHOOK_URL` 或 `ALERT_SLACK_WEBHOOK_URL` 后，即可开启站外投递。",
      },
      badges: {
        acknowledged: "已确认",
        muted: "已静默",
        dispatchable: "可投递",
        alertState: "告警状态",
        triggered: (time: string) => `触发于 ${time}`,
      },
      actions: {
        open: "打开处理页",
        reopen: "重新打开",
        acknowledge: "确认",
        unmute: "解除静默",
        mute24h: "静默 24 小时",
      },
      empty:
        "当前没有活跃的可执行告警。可以继续参考下方审计流和 observability 快照做日常巡检。",
      updatedAt: (time: string) => `数据更新时间 ${time}。`,
    },
    audit: {
      title: "最近审计活动",
      description:
        "这里汇总最新的高价值管理与教师操作，方便 Day 2 支持直接判断是谁、在什么时候改了什么，而无需直接查库。",
      loading: "正在加载最近审计活动...",
      loadError: "最近审计活动加载失败。",
      unknownActor: "未知操作者",
      empty: "当前还没有记录到任何审计活动。",
    },
    observability: {
      title: "实时可观测性",
      description:
        "把当前轮次压力、评分积压和近期运营动作压缩到同一张管理视图里，便于快速发现运营瓶颈。",
      loading: "正在加载可观测性信号...",
      loadError: "可观测性快照加载失败。",
      cards: {
        processingRounds: "处理中轮次",
        activeClasses: (count: number) => `活跃班级 ${count}`,
        overdueRounds: "逾期轮次",
        missingSubmissions: (count: number) => `缺失提交 ${count}`,
        awaitingSubmissions: "等待提交的班级",
        teamsOutstanding: "本轮仍有队伍未完成提交",
        ungradedResults: "未评分结果",
        auditEvents24h: (count: number) => `24 小时审计事件 ${count}`,
      },
      roundPressure: {
        title: "轮次压力",
        updatedAt: (time: string) => `更新时间 ${time}`,
        submitted: (roundNumber: number, submittedTeams: number, totalTeams: number) =>
          `第 ${roundNumber} 轮 | 已提交 ${submittedTeams} / ${totalTeams}`,
        overdue: "已逾期",
        missingTeams: (missingTeams: number, deadline: string) =>
          `缺失队伍 ${missingTeams} | 截止 ${deadline}`,
        empty: "当前没有明显的提交或处理压力。",
      },
      gradingBacklog: {
        title: "评分积压",
        summary: (ungradedResults: number, latestUngradedRound: number) =>
          `未评分结果 ${ungradedResults} | 最近待处理轮次 ${latestUngradedRound}`,
        empty: "当前没有教师评分积压。",
      },
      operatorActivity: {
        title: "24 小时运营动作",
        empty: "过去 24 小时没有记录到运营 mutation。",
      },
    },
    ownership: {
      title: "归属快照",
      description:
        "按负责教师或管理员聚合学期与班级归属，帮助管理端快速发现负载过高或空闲的运营者。",
      activeClasses: (count: number) => `活跃班级 ${count}`,
      semesters: (count: number) => `学期 ${count}`,
      classes: (count: number) => `班级 ${count}`,
      empty: "当前还没有教师或管理员拥有任何学期/班级归属记录。",
    },
    spotlight: {
      title: "聚焦班级",
      description:
        "聚焦班级让管理端无需先跳进详情页，也能把注意力持续放在当前最关键的活跃班级上。",
      owner: "负责人",
      joinCode: "加入码",
      round: "轮次",
      teamLoad: "队伍负载",
      openDetail: "打开完整班级详情",
      empty: "请先创建班级，聚焦工作区才会启用。",
    },
    latestClasses: {
      title: "最新班级",
      description: "这些记录用于展示最近创建或最近活跃的班级。",
      owner: "负责人",
      teams: (teams: number, maxTeams: number) => `队伍 ${teams} / ${maxTeams}`,
      students: (count: number) => `学生 ${count}`,
      rounds: (currentRound: number, maxRounds: number) => `轮次 ${currentRound} / ${maxRounds}`,
      createdRounds: (count: number) => `已创建轮次记录 ${count}`,
      spotlight: "设为聚焦",
      detail: "详情",
    },
    recentSemesters: {
      title: "最近学期",
      description: "近期教学窗口及其班级负载会保留在这里，便于管理端快速分诊。",
      classes: (count: number, startDate: string) => `班级 ${count} | 开始 ${startDate}`,
      end: (endDate: string) => `结束 ${endDate}`,
      openClasses: "打开班级",
    },
  },
  "en-US": {
    hero: {
      badgeLabel: "Admin / Dashboard",
      title: "Platform oversight across users, semesters, and live classes",
      description:
        "This admin overview summarizes user, semester, and class data so platform monitoring stays aligned with day-to-day operations.",
      statusTitle: "Platform readiness",
      statusBodySelected: (className: string) =>
        `${className} is currently spotlighted so admins can keep a live cohort in view while navigating users, semesters, and classes.`,
      statusBodyDefault:
        "User, semester, and class counts come from the same management data source, keeping platform oversight aligned with other admin views.",
      summaryLabels: {
        users: "Users",
        semesters: "Semesters",
        classes: "Classes",
        assigned: "Assigned",
      },
      summaryHints: {
        users: (teachers: number, students: number) => `Teachers ${teachers} | Students ${students}`,
        semesters: (activeSemesters: number, admins: number) =>
          `Active ${activeSemesters} | Admins ${admins}`,
        classes: (activeClasses: number, setupClasses: number) =>
          `Active ${activeClasses} | Setup ${setupClasses}`,
        assigned: "Students already placed on teams.",
      },
      actions: {
        users: "Open users",
        semesters: "Open semesters",
        classes: "Open classes",
        spotlight: "Open spotlight class",
        detail: "Open class detail",
      },
    },
    loading: "Loading platform oversight data...",
    loadError: "Failed to load the admin dashboard.",
    platformMix: {
      title: "Platform mix",
      description:
        "These totals stay visible outside the hero so admins can keep a denser operational snapshot on screen while reviewing the ownership and spotlight sections below.",
      cards: {
        users: "Users",
        semesters: "Semesters",
        classes: "Classes",
        assignments: "Assignments",
        usersHint: (teachers: number, students: number) => `Teachers ${teachers} | Students ${students}`,
        semestersHint: (activeSemesters: number) => `Active ${activeSemesters}`,
        classesHint: (activeClasses: number, setupClasses: number) =>
          `Active ${activeClasses} | Setup ${setupClasses}`,
        assignmentsHint: "Students already placed on teams",
      },
    },
    alerts: {
      title: "Actionable alerts",
      description:
        "These derived alerts translate raw observability signals into severity-ranked next actions so admins can jump straight from detection into the right operational route.",
      loading: "Loading actionable alerts...",
      loadError: "Failed to load the actionable alert feed.",
      notices: {
        acknowledged: "The alert has been acknowledged and will stay visible for operator follow-up.",
        reopened: "The alert has been reopened and can participate in the next external dispatch.",
        muted: (muteHours: number) => `The alert has been muted for ${muteHours} hours.`,
        unmuted: "The alert mute has been removed and the signal is active again.",
        stateFailed: "The alert state update failed.",
        noDispatchable: (minimumSeverity: string) =>
          `No ${minimumSeverity}+ dispatchable alerts were available, so delivery was skipped cleanly.`,
        dispatched: (count: number, minimumSeverity: string, sentCount: number, failedCount: number) =>
          `Dispatched ${count} ${minimumSeverity}+ alerts across ${sentCount} channel(s)${failedCount > 0 ? ` with ${failedCount} failed channel attempt(s)` : ""}.`,
        deliveryFailed: "External alert delivery failed.",
      },
      summary: {
        totalSignals: "Total signals",
        showingCount: (count: number) => `Showing ${count} on the dashboard`,
        openAlerts: "Open alerts",
        notAcknowledged: "Not acknowledged yet",
        acknowledged: "Acknowledged",
        acknowledgedHint: "Temporarily under operator ownership",
        muted: "Muted",
        mutedHint: "Hidden from active paging until mute expiry",
        dispatchable: "Dispatchable",
        dispatchableHint: "Eligible for external alert delivery",
        delivery: "Delivery",
        deliveryHint: (enabledCount: number, totalCount: number) =>
          `Enabled ${enabledCount} of ${totalCount} configured channel(s)`,
      },
      deliveryPanel: {
        title: "External delivery",
        description:
          "Acknowledged or muted alerts are excluded from external paging. The dispatch action below sends the current high+ alert digest to every enabled channel without exposing raw secrets in the UI.",
        noChannels: "No delivery channels configured",
        disabledSuffix: "disabled",
        severityBreakdown: {
          critical: "Critical",
          high: "High",
          medium: "Medium",
          info: "Info",
        },
        dispatchButton: "Dispatch high+ alerts",
        refreshButton: "Refresh alert feed",
        enabledTargets: (targets: string) => `Enabled targets: ${targets}.`,
        configureHint:
          "Configure EMAIL_SERVER / ALERT_EMAIL_TO, ALERT_WEBHOOK_URL, or ALERT_SLACK_WEBHOOK_URL to enable stand-alone delivery.",
      },
      badges: {
        acknowledged: "Acknowledged",
        muted: "Muted",
        dispatchable: "Dispatchable",
        alertState: "Alert state",
        triggered: (time: string) => `Triggered ${time}`,
      },
      actions: {
        open: "Open action",
        reopen: "Reopen",
        acknowledge: "Acknowledge",
        unmute: "Unmute",
        mute24h: "Mute 24h",
      },
      empty:
        "No actionable alerts are active right now. Keep the audit feed and observability snapshot below open for routine monitoring.",
      updatedAt: (time: string) => `Updated ${time}.`,
    },
    audit: {
      title: "Recent audit activity",
      description:
        "This feed surfaces the newest high-value admin and teacher mutations so day-2 support can verify who changed what without querying the database directly.",
      loading: "Loading recent audit activity...",
      loadError: "Failed to load recent audit activity.",
      unknownActor: "Unknown actor",
      empty: "No audit activity has been recorded yet.",
    },
    observability: {
      title: "Live observability",
      description:
        "These signals compress current round pressure, grading backlog, and recent operator activity into one admin-facing control view.",
      loading: "Loading observability signals...",
      loadError: "Failed to load the observability snapshot.",
      cards: {
        processingRounds: "Processing rounds",
        activeClasses: (count: number) => `Active classes ${count}`,
        overdueRounds: "Overdue rounds",
        missingSubmissions: (count: number) => `Missing submissions ${count}`,
        awaitingSubmissions: "Classes awaiting submissions",
        teamsOutstanding: "Teams still outstanding this round",
        ungradedResults: "Ungraded results",
        auditEvents24h: (count: number) => `Audit events 24h ${count}`,
      },
      roundPressure: {
        title: "Round pressure",
        updatedAt: (time: string) => `Updated ${time}`,
        submitted: (roundNumber: number, submittedTeams: number, totalTeams: number) =>
          `Round ${roundNumber} | ${submittedTeams} / ${totalTeams} submitted`,
        overdue: "Overdue",
        missingTeams: (missingTeams: number, deadline: string) =>
          `Missing teams ${missingTeams} | Deadline ${deadline}`,
        empty: "No active submission or processing pressure is visible right now.",
      },
      gradingBacklog: {
        title: "Grading backlog",
        summary: (ungradedResults: number, latestUngradedRound: number) =>
          `Ungraded results ${ungradedResults} | Latest pending round ${latestUngradedRound}`,
        empty: "No teacher grading backlog is visible.",
      },
      operatorActivity: {
        title: "24h operator activity",
        empty: "No operator mutations were recorded in the last 24 hours.",
      },
    },
    ownership: {
      title: "Ownership snapshot",
      description:
        "Semester and class ownership is grouped by responsible teacher so admins can spot overloaded or idle operators quickly.",
      activeClasses: (count: number) => `Active classes ${count}`,
      semesters: (count: number) => `Semesters ${count}`,
      classes: (count: number) => `Classes ${count}`,
      empty: "No teacher or admin ownership records exist yet.",
    },
    spotlight: {
      title: "Spotlight class",
      description:
        "The selected class keeps admin attention on the most relevant live cohort without opening the full detail route first.",
      owner: "Owner",
      joinCode: "Join code",
      round: "Round",
      teamLoad: "Team load",
      openDetail: "Open full class detail",
      empty: "Create a class first to activate the spotlight workspace.",
    },
    latestClasses: {
      title: "Latest classes",
      description: "These records highlight the most recently created or active cohorts.",
      owner: "Owner",
      teams: (teams: number, maxTeams: number) => `Teams ${teams} / ${maxTeams}`,
      students: (count: number) => `Students ${count}`,
      rounds: (currentRound: number, maxRounds: number) => `Rounds ${currentRound} / ${maxRounds}`,
      createdRounds: (count: number) => `Created round records ${count}`,
      spotlight: "Spotlight",
      detail: "Detail",
    },
    recentSemesters: {
      title: "Recent semesters",
      description: "Recent teaching windows and their class load stay visible here for quick admin triage.",
      classes: (count: number, startDate: string) => `Classes ${count} | Start ${startDate}`,
      end: (endDate: string) => `End ${endDate}`,
      openClasses: "Open classes",
    },
  },
} as const;

function getAlertSeverityLabel(locale: "zh-CN" | "en-US", severity: PlatformAlertSeverity) {
  return alertSeverityLabels[locale][severity];
}

function getAlertCategoryLabel(locale: "zh-CN" | "en-US", category: PlatformAlertCategory) {
  return alertCategoryLabels[locale][category];
}

function getAlertChannelLabel(locale: "zh-CN" | "en-US", channel: AlertDeliveryChannel) {
  return alertChannelLabels[locale][channel];
}

function getAlertBadgeVariant(
  severity: PlatformAlertSeverity
): BadgeProps["variant"] {
  switch (severity) {
    case "critical":
      return "destructive";
    case "high":
      return "default";
    case "medium":
      return "secondary";
    case "info":
    default:
      return "outline";
  }
}

function getAlertCardClassName(severity: PlatformAlertSeverity) {
  switch (severity) {
    case "critical":
      return "border-destructive/30 bg-destructive/[0.08] shadow-[0_24px_50px_-32px_rgba(127,29,29,0.45)]";
    case "high":
      return "border-primary/25 bg-primary/[0.1] shadow-[0_24px_50px_-32px_rgba(14,165,233,0.35)]";
    case "medium":
      return "border-white/10 bg-white/[0.045]";
    case "info":
    default:
      return "border-dashed border-white/10 bg-white/[0.03]";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildAuditSummary(locale: "zh-CN" | "en-US", auditLog: AuditLogItem) {
  const entityTypeLabel =
    entityTypeLabels[locale][
      auditLog.entityType as keyof (typeof entityTypeLabels)["zh-CN"]
    ] ?? auditLog.entityType;

  if (!isRecord(auditLog.details)) {
    return `${entityTypeLabel} ${auditLog.entityId}`;
  }

  if (auditLog.action === "user.role.update") {
    const nextRole = getUserRoleLabel(
      locale,
      String(auditLog.details.nextRole ?? "updated")
    );
    return locale === "zh-CN"
      ? `${String(auditLog.details.email ?? auditLog.entityId)} -> ${nextRole}`
      : `${String(auditLog.details.email ?? auditLog.entityId)} -> ${nextRole}`;
  }

  if (auditLog.action === "team.create") {
    return locale === "zh-CN"
      ? `${String(auditLog.details.teamName ?? auditLog.entityId)} | 成员 ${String(
          auditLog.details.memberCount ?? "-"
        )}`
      : `${String(auditLog.details.teamName ?? auditLog.entityId)} | Members ${String(
          auditLog.details.memberCount ?? "-"
        )}`;
  }

  if (auditLog.action === "roster.csv.apply") {
    return locale === "zh-CN"
      ? `导入 ${String(auditLog.details.createdTeamCount ?? "-")} 支队伍，替换 ${String(
          auditLog.details.replacedTeamCount ?? "-"
        )} 支旧队伍`
      : `Imported ${String(auditLog.details.createdTeamCount ?? "-")} teams and replaced ${String(
          auditLog.details.replacedTeamCount ?? "-"
        )}`;
  }

  if (auditLog.action === "simulation.process") {
    return locale === "zh-CN"
      ? `第 ${String(auditLog.details.processedRoundNumber ?? "-")} 轮 | 队伍 ${String(
          auditLog.details.processedTeamCount ?? "-"
        )}`
      : `Round ${String(auditLog.details.processedRoundNumber ?? "-")} | Teams ${String(
          auditLog.details.processedTeamCount ?? "-"
        )}`;
  }

  if (auditLog.action === "grading.save") {
    return locale === "zh-CN"
      ? `第 ${String(auditLog.details.roundNumber ?? "-")} 轮 | 队伍 ${String(
          auditLog.details.teamId ?? auditLog.entityId
        )}`
      : `Round ${String(auditLog.details.roundNumber ?? "-")} | Team ${String(
          auditLog.details.teamId ?? auditLog.entityId
        )}`;
  }

  if ("name" in auditLog.details && typeof auditLog.details.name === "string") {
    return auditLog.details.name;
  }

  if ("teamName" in auditLog.details && typeof auditLog.details.teamName === "string") {
    return auditLog.details.teamName;
  }

  return `${entityTypeLabel} ${auditLog.entityId}`;
}

function formatAlertActor(locale: "zh-CN" | "en-US", actor: AlertActorReference | null) {
  return actor?.name ?? actor?.email ?? actor?.id ?? (locale === "zh-CN" ? "一位运营人员" : "an operator");
}

function buildAlertStateSummary(locale: "zh-CN" | "en-US", alert: PlatformAlertItem) {
  const parts: string[] = [];

  if (alert.state.isAcknowledged) {
    parts.push(
      locale === "zh-CN"
        ? `由 ${formatAlertActor(locale, alert.state.acknowledgedBy)} 于 ${formatDate(
            alert.state.acknowledgedAt
          )} 确认。`
        : `Acknowledged by ${formatAlertActor(locale, alert.state.acknowledgedBy)} on ${formatDate(
            alert.state.acknowledgedAt
          )}.`
    );
  }

  if (alert.state.isMuted) {
    parts.push(
      locale === "zh-CN"
        ? `由 ${formatAlertActor(locale, alert.state.mutedBy)} 静默至 ${formatDate(
            alert.state.mutedUntil
          )}。`
        : `Muted until ${formatDate(alert.state.mutedUntil)} by ${formatAlertActor(
            locale,
            alert.state.mutedBy
          )}.`
    );
  }

  if (parts.length === 0) {
    parts.push(
      alert.dispatchable
        ? locale === "zh-CN"
          ? "当前仍处于打开状态，并且可参与下一次站外高优先级告警投递。"
          : "Open and still eligible for the next external high+ alert dispatch."
        : locale === "zh-CN"
          ? "当前仍处于打开状态，但暂时不会参与站外投递。"
          : "Open, but currently excluded from external dispatch."
    );
  }

  return parts.join(" ");
}

export function AdminDashboardPanel({
  initialClassId,
}: AdminDashboardPanelProps) {
  const { locale } = useLocale();
  const copy = adminDashboardCopy[locale];
  const queryClient = useQueryClient();
  const [selectedClassId, setSelectedClassId] = useState(initialClassId ?? "");
  const [alertNotice, setAlertNotice] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const usersQuery = useQuery({
    queryKey: ["admin-dashboard-users"],
    queryFn: () => apiFetch<UsersResponse>("/api/users"),
  });

  const semestersQuery = useQuery({
    queryKey: ["admin-dashboard-semesters"],
    queryFn: () => apiFetch<SemestersResponse>("/api/semesters"),
  });

  const classesQuery = useQuery({
    queryKey: ["admin-dashboard-classes"],
    queryFn: () => apiFetch<ClassesResponse>("/api/classes"),
  });
  const auditLogsQuery = useQuery({
    queryKey: ["admin-dashboard-audit-logs"],
    queryFn: () => apiFetch<AuditLogsResponse>("/api/audit-logs?limit=8"),
  });
  const alertsQuery = useQuery({
    queryKey: ["admin-dashboard-alerts"],
    queryFn: () => apiFetch<AlertsResponse>("/api/alerts?limit=6"),
  });
  const observabilityQuery = useQuery({
    queryKey: ["admin-dashboard-observability"],
    queryFn: () => apiFetch<ObservabilitySnapshot>("/api/observability"),
  });
  const alertStateMutation = useMutation({
    mutationFn: (payload: {
      alertId: string;
      action: "acknowledge" | "unacknowledge" | "mute" | "unmute";
      muteHours?: number;
    }) =>
      apiFetch<AlertStateMutationResponse>("/api/alerts/state", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async (_, variables) => {
      setAlertNotice({
        tone: "success",
        message:
          variables.action === "acknowledge"
            ? copy.alerts.notices.acknowledged
            : variables.action === "unacknowledge"
              ? copy.alerts.notices.reopened
              : variables.action === "mute"
                ? copy.alerts.notices.muted(variables.muteHours ?? 24)
                : copy.alerts.notices.unmuted,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard-alerts"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard-audit-logs"] }),
      ]);
    },
    onError: (error) => {
      setAlertNotice({
        tone: "error",
        message:
          error instanceof ApiClientError
            ? error.message
            : copy.alerts.notices.stateFailed,
      });
    },
  });
  const alertDeliveryMutation = useMutation({
    mutationFn: (payload: {
      minimumSeverity?: PlatformAlertSeverity;
      channels?: AlertDeliveryChannel[];
    }) =>
      apiFetch<AlertDeliveryMutationResponse>("/api/alerts/deliver", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async (result) => {
      const sentCount = result.results.filter((item) => item.status === "sent").length;
      const failedCount = result.results.filter((item) => item.status === "failed").length;

      setAlertNotice({
        tone: failedCount > 0 ? "error" : "success",
        message:
          result.alertsDispatched === 0
            ? copy.alerts.notices.noDispatchable(
                getAlertSeverityLabel(locale, result.minimumSeverity)
              )
            : copy.alerts.notices.dispatched(
                result.alertsDispatched,
                getAlertSeverityLabel(locale, result.minimumSeverity),
                sentCount,
                failedCount
              ),
      });

      await queryClient.invalidateQueries({ queryKey: ["admin-dashboard-audit-logs"] });
    },
    onError: (error) => {
      setAlertNotice({
        tone: "error",
        message:
          error instanceof ApiClientError
            ? error.message
            : copy.alerts.notices.deliveryFailed,
      });
    },
  });

  const users = useMemo(() => usersQuery.data?.users ?? [], [usersQuery.data?.users]);
  const semesters = useMemo(
    () => semestersQuery.data?.semesters ?? [],
    [semestersQuery.data?.semesters]
  );
  const classes = useMemo(
    () => classesQuery.data?.classes ?? [],
    [classesQuery.data?.classes]
  );
  const auditLogs = useMemo(
    () => auditLogsQuery.data?.auditLogs ?? [],
    [auditLogsQuery.data?.auditLogs]
  );
  const alerts = useMemo(
    () => alertsQuery.data?.alerts ?? [],
    [alertsQuery.data?.alerts]
  );
  const alertsSnapshot = alertsQuery.data ?? null;
  const deliveryChannels = alertsSnapshot?.delivery?.channels ?? [];
  const enabledDeliveryChannels = deliveryChannels.filter((channel) => channel.enabled);
  const observability = observabilityQuery.data ?? null;

  useEffect(() => {
    if (initialClassId) {
      setSelectedClassId(initialClassId);
      return;
    }

    // Keep the dashboard spotlight focused on a real class by default so admin
    // operators land on a meaningful cohort instead of an empty right rail.
    if (!selectedClassId && classes.length > 0) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, initialClassId, selectedClassId]);

  const selectedClass =
    classes.find((courseClass) => courseClass.id === selectedClassId) ?? null;
  const selectedClassStatusLabel = getClassStatusLabel(locale, selectedClass?.status);

  const teacherLoad = useMemo(() => {
    // This grouping is derived from the same live user, semester, and class
    // payloads shown elsewhere on the page so load-balancing decisions stay
    // anchored to one consistent snapshot of platform ownership.
    const owners = users.filter(
      (user) => user.role === "TEACHER" || user.role === "ADMIN"
    );

    return owners
      .map((owner) => {
        const ownedSemesters = semesters.filter(
          (semester) => semester.creator.id === owner.id
        );
        const ownedClasses = classes.filter(
          (courseClass) => courseClass.semester.creator.id === owner.id
        );

        return {
          id: owner.id,
          name: owner.name ?? owner.email,
          email: owner.email,
          role: owner.role,
          semesters: ownedSemesters.length,
          classes: ownedClasses.length,
          activeClasses: ownedClasses.filter(
            (courseClass) => courseClass.status === "IN_PROGRESS"
          ).length,
        };
      })
      .filter((owner) => owner.semesters > 0 || owner.classes > 0)
      .sort((left, right) => right.classes - left.classes);
  }, [classes, semesters, users]);

  const totals = useMemo(
    () => ({
      users: users.length,
      teachers: users.filter((user) => user.role === "TEACHER").length,
      admins: users.filter((user) => user.role === "ADMIN").length,
      students: users.filter((user) => user.role === "STUDENT").length,
      studentsAssigned: users.filter(
        (user) => user.role === "STUDENT" && user._count.teamMembers > 0
      ).length,
      semesters: semesters.length,
      activeSemesters: semesters.filter((semester) => semester.status === "ACTIVE")
        .length,
      classes: classes.length,
      activeClasses: classes.filter((courseClass) => courseClass.status === "IN_PROGRESS")
        .length,
      setupClasses: classes.filter((courseClass) => courseClass.status === "SETUP").length,
      teams: classes.reduce((sum, courseClass) => sum + courseClass._count.teams, 0),
    }),
    [classes, semesters, users]
  );

  const dashboardError =
    usersQuery.error ?? semestersQuery.error ?? classesQuery.error ?? null;
  const dashboardLoading =
    usersQuery.isLoading || semestersQuery.isLoading || classesQuery.isLoading;

  return (
    <div className="flex flex-col gap-6">
      <AdminWorkspaceHero
        badgeLabel={copy.hero.badgeLabel}
        title={copy.hero.title}
        description={copy.hero.description}
        statusTitle={copy.hero.statusTitle}
        statusBody={
          selectedClass
            ? copy.hero.statusBodySelected(selectedClass.name)
            : copy.hero.statusBodyDefault
        }
        summaryItems={[
          {
            label: copy.hero.summaryLabels.users,
            value: dashboardLoading ? "..." : String(totals.users),
            hint: copy.hero.summaryHints.users(totals.teachers, totals.students),
          },
          {
            label: copy.hero.summaryLabels.semesters,
            value: dashboardLoading ? "..." : String(totals.semesters),
            hint: copy.hero.summaryHints.semesters(totals.activeSemesters, totals.admins),
          },
          {
            label: copy.hero.summaryLabels.classes,
            value: dashboardLoading ? "..." : String(totals.classes),
            hint: copy.hero.summaryHints.classes(totals.activeClasses, totals.setupClasses),
          },
          {
            label: copy.hero.summaryLabels.assigned,
            value: dashboardLoading
              ? "..."
              : `${totals.studentsAssigned} / ${totals.students}`,
            hint: copy.hero.summaryHints.assigned,
          },
        ]}
        actions={[
          { href: "/admin/users", label: copy.hero.actions.users, variant: "default" },
          { href: "/admin/semesters", label: copy.hero.actions.semesters },
          { href: "/admin/classes", label: copy.hero.actions.classes },
          {
            href: selectedClass
              ? `/admin/classes/${selectedClass.id}`
              : "/admin/classes",
            label: selectedClass ? copy.hero.actions.spotlight : copy.hero.actions.detail,
          },
        ]}
      />

      {dashboardLoading ? (
        <Card className="border-white/10 bg-white/[0.035] shadow-[0_30px_70px_-42px_rgba(2,6,23,0.88)]">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {copy.loading}
          </CardContent>
        </Card>
      ) : dashboardError ? (
        <Card className="border-destructive/30 bg-destructive/[0.06] shadow-[0_30px_70px_-42px_rgba(2,6,23,0.88)]">
          <CardContent className="p-6 text-sm text-destructive">
            {dashboardError instanceof ApiClientError
              ? dashboardError.message
              : copy.loadError}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-white/10 bg-white/[0.035] shadow-[0_30px_70px_-42px_rgba(2,6,23,0.88)]">
            <CardHeader>
              <CardTitle className="text-xl">{copy.platformMix.title}</CardTitle>
              <CardDescription>
                {copy.platformMix.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm text-muted-foreground">{copy.platformMix.cards.users}</p>
                <p className="mt-2 text-2xl font-semibold">{totals.users}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {copy.platformMix.cards.usersHint(totals.teachers, totals.students)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm text-muted-foreground">
                  {copy.platformMix.cards.semesters}
                </p>
                <p className="mt-2 text-2xl font-semibold">{totals.semesters}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {copy.platformMix.cards.semestersHint(totals.activeSemesters)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm text-muted-foreground">{copy.platformMix.cards.classes}</p>
                <p className="mt-2 text-2xl font-semibold">{totals.classes}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {copy.platformMix.cards.classesHint(
                    totals.activeClasses,
                    totals.setupClasses
                  )}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm text-muted-foreground">
                  {copy.platformMix.cards.assignments}
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {totals.studentsAssigned} / {totals.students}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {copy.platformMix.cards.assignmentsHint}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/[0.035] shadow-[0_30px_70px_-42px_rgba(2,6,23,0.88)]">
            <CardHeader>
              <CardTitle className="text-xl">{copy.alerts.title}</CardTitle>
              <CardDescription>
                {copy.alerts.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {alertsQuery.isLoading ? (
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {copy.alerts.loading}
                </div>
              ) : alertsQuery.error ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/[0.08] p-4 text-sm text-destructive">
                  {alertsQuery.error instanceof ApiClientError
                    ? alertsQuery.error.message
                    : copy.alerts.loadError}
                </div>
              ) : alertsSnapshot ? (
                <>
                  {alertNotice ? (
                    <div
                      className={
                        alertNotice.tone === "success"
                          ? "rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.1] p-4 text-sm text-emerald-100"
                          : "rounded-2xl border border-destructive/30 bg-destructive/[0.08] p-4 text-sm text-destructive"
                      }
                    >
                      {alertNotice.message}
                    </div>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-sm text-muted-foreground">
                        {copy.alerts.summary.totalSignals}
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {alertsSnapshot.summary.total}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {copy.alerts.summary.showingCount(alerts.length)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-destructive/25 bg-destructive/[0.08] p-4">
                      <p className="text-sm text-muted-foreground">
                        {copy.alerts.summary.openAlerts}
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {alertsSnapshot.summary.open}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {copy.alerts.summary.notAcknowledged}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-sm text-muted-foreground">
                        {copy.alerts.summary.acknowledged}
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {alertsSnapshot.summary.acknowledged}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {copy.alerts.summary.acknowledgedHint}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-sm text-muted-foreground">{copy.alerts.summary.muted}</p>
                      <p className="mt-2 text-2xl font-semibold">
                        {alertsSnapshot.summary.muted}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {copy.alerts.summary.mutedHint}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-primary/25 bg-primary/[0.1] p-4">
                      <p className="text-sm text-muted-foreground">
                        {copy.alerts.summary.dispatchable}
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {alertsSnapshot.summary.dispatchable}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {copy.alerts.summary.dispatchableHint}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4">
                      <p className="text-sm text-muted-foreground">
                        {copy.alerts.summary.delivery}
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {enabledDeliveryChannels.length}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {copy.alerts.summary.deliveryHint(
                          enabledDeliveryChannels.length,
                          deliveryChannels.length
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {copy.alerts.deliveryPanel.title}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {copy.alerts.deliveryPanel.description}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {deliveryChannels.length > 0 ? (
                            deliveryChannels.map((channel) => (
                              <Badge
                                key={channel.channel}
                                variant={channel.enabled ? "secondary" : "outline"}
                              >
                                {getAlertChannelLabel(locale, channel.channel)}
                                {channel.targetLabel ? ` · ${channel.targetLabel}` : ""}
                                {!channel.enabled
                                  ? ` · ${copy.alerts.deliveryPanel.disabledSuffix}`
                                  : ""}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="outline">
                              {copy.alerts.deliveryPanel.noChannels}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>
                            {copy.alerts.deliveryPanel.severityBreakdown.critical}{" "}
                            {alertsSnapshot.summary.critical}
                          </span>
                          <span>
                            {copy.alerts.deliveryPanel.severityBreakdown.high}{" "}
                            {alertsSnapshot.summary.high}
                          </span>
                          <span>
                            {copy.alerts.deliveryPanel.severityBreakdown.medium}{" "}
                            {alertsSnapshot.summary.medium}
                          </span>
                          <span>
                            {copy.alerts.deliveryPanel.severityBreakdown.info}{" "}
                            {alertsSnapshot.summary.info}
                          </span>
                        </div>
                      </div>
                      <div className="flex w-full max-w-sm flex-col gap-2">
                        <Button
                          className="gap-2"
                          disabled={
                            alertDeliveryMutation.isPending ||
                            enabledDeliveryChannels.length === 0 ||
                            alertsSnapshot.summary.dispatchable === 0
                          }
                          onClick={() => {
                            setAlertNotice(null);
                            alertDeliveryMutation.mutate({
                              minimumSeverity: "high",
                            });
                          }}
                        >
                          {alertDeliveryMutation.isPending ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : null}
                          {copy.alerts.deliveryPanel.dispatchButton}
                        </Button>
                        <Button
                          variant="outline"
                          className="gap-2"
                          disabled={alertsQuery.isFetching}
                          onClick={() => {
                            setAlertNotice(null);
                            void alertsQuery.refetch();
                          }}
                        >
                          {alertsQuery.isFetching ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : null}
                          {copy.alerts.deliveryPanel.refreshButton}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          {enabledDeliveryChannels.length > 0
                            ? copy.alerts.deliveryPanel.enabledTargets(
                                enabledDeliveryChannels
                                  .map(
                                    (channel) =>
                                      channel.targetLabel ??
                                      getAlertChannelLabel(locale, channel.channel)
                                  )
                                  .join(", ")
                              )
                            : copy.alerts.deliveryPanel.configureHint}
                        </p>
                      </div>
                    </div>
                  </div>

                  {alerts.length > 0 ? (
                    <div className="space-y-3">
                      {alerts.map((alert) => (
                        <div
                          key={alert.id}
                          className={cn(
                            "rounded-2xl border p-4",
                            getAlertCardClassName(alert.severity)
                          )}
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={getAlertBadgeVariant(alert.severity)}>
                                  {getAlertSeverityLabel(locale, alert.severity)}
                                </Badge>
                                <Badge variant="outline">
                                  {getAlertCategoryLabel(locale, alert.category)}
                                </Badge>
                                <Badge variant="outline">
                                  {(entityTypeLabels[locale][alert.entityType] ?? alert.entityType)} /{" "}
                                  {alert.entityId}
                                </Badge>
                                {alert.state.isAcknowledged ? (
                                  <Badge variant="secondary">
                                    {copy.alerts.badges.acknowledged}
                                  </Badge>
                                ) : null}
                                {alert.state.isMuted ? (
                                  <Badge variant="outline">{copy.alerts.badges.muted}</Badge>
                                ) : null}
                                {alert.dispatchable ? (
                                  <Badge variant="outline">
                                    {copy.alerts.badges.dispatchable}
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="mt-3 font-medium text-foreground">
                                {alert.title}
                              </p>
                              <p className="mt-2 text-sm text-muted-foreground">
                                {alert.message}
                              </p>
                              <p className="mt-3 text-sm text-foreground">
                                {alert.recommendedAction}
                              </p>
                              <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                  {copy.alerts.badges.alertState}
                                </p>
                                <p className="mt-2 text-sm text-muted-foreground">
                                  {buildAlertStateSummary(locale, alert)}
                                </p>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {copy.alerts.badges.triggered(formatDate(alert.createdAt))}
                            </p>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Link
                              href={alert.href}
                              className={cn(
                                buttonVariants({ variant: "outline", size: "sm" }),
                                "gap-2"
                              )}
                              >
                              {copy.alerts.actions.open}
                              <ArrowRight className="size-4" />
                            </Link>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={
                                alertStateMutation.isPending &&
                                alertStateMutation.variables?.alertId === alert.id
                              }
                              onClick={() => {
                                setAlertNotice(null);
                                alertStateMutation.mutate({
                                  alertId: alert.id,
                                  action: alert.state.isAcknowledged
                                    ? "unacknowledge"
                                    : "acknowledge",
                                });
                              }}
                            >
                              {alertStateMutation.isPending &&
                              alertStateMutation.variables?.alertId === alert.id ? (
                                <Loader2 className="mr-2 size-4 animate-spin" />
                              ) : null}
                              {alert.state.isAcknowledged
                                ? copy.alerts.actions.reopen
                                : copy.alerts.actions.acknowledge}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={
                                alertStateMutation.isPending &&
                                alertStateMutation.variables?.alertId === alert.id
                              }
                              onClick={() => {
                                setAlertNotice(null);
                                alertStateMutation.mutate({
                                  alertId: alert.id,
                                  action: alert.state.isMuted ? "unmute" : "mute",
                                  muteHours: alert.state.isMuted ? undefined : 24,
                                });
                              }}
                            >
                              {alert.state.isMuted
                                ? copy.alerts.actions.unmute
                                : copy.alerts.actions.mute24h}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                      {copy.alerts.empty}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    {copy.alerts.updatedAt(formatDate(alertsSnapshot.generatedAt))}
                  </p>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/95 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">{copy.audit.title}</CardTitle>
              <CardDescription>
                {copy.audit.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {auditLogsQuery.isLoading ? (
                <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {copy.audit.loading}
                </div>
              ) : auditLogsQuery.error ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  {auditLogsQuery.error instanceof ApiClientError
                    ? auditLogsQuery.error.message
                    : copy.audit.loadError}
                </div>
              ) : auditLogs.length > 0 ? (
                auditLogs.map((auditLog) => (
                  <div
                    key={auditLog.id}
                    className="rounded-2xl border border-border/70 bg-muted/20 p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">
                            {formatAuditActionLabel(locale, auditLog.action)}
                          </p>
                          <Badge variant="outline">
                            {(entityTypeLabels[locale][auditLog.entityType as keyof typeof entityTypeLabels["zh-CN"]] ??
                              auditLog.entityType)}{" "}
                            / {auditLog.entityId}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {auditLog.actor
                            ? `${auditLog.actor.name ?? auditLog.actor.email} (${getUserRoleLabel(
                                locale,
                                auditLog.actor.role
                              )})`
                            : copy.audit.unknownActor}
                          {auditLog.ipAddress ? ` | ${auditLog.ipAddress}` : ""}
                        </p>
                        <p className="mt-2 text-sm text-foreground">
                          {buildAuditSummary(locale, auditLog)}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(auditLog.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                  {copy.audit.empty}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/95 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">{copy.observability.title}</CardTitle>
              <CardDescription>
                {copy.observability.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {observabilityQuery.isLoading ? (
                <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {copy.observability.loading}
                </div>
              ) : observabilityQuery.error ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  {observabilityQuery.error instanceof ApiClientError
                    ? observabilityQuery.error.message
                    : copy.observability.loadError}
                </div>
              ) : observability ? (
                <>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                      <p className="text-sm text-muted-foreground">
                        {copy.observability.cards.processingRounds}
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {observability.summary.activeProcessingRounds}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {copy.observability.cards.activeClasses(
                          observability.summary.activeClasses
                        )}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                      <p className="text-sm text-muted-foreground">
                        {copy.observability.cards.overdueRounds}
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {observability.summary.overduePendingRounds}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {copy.observability.cards.missingSubmissions(
                          observability.summary.missingSubmissions
                        )}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                      <p className="text-sm text-muted-foreground">
                        {copy.observability.cards.awaitingSubmissions}
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {observability.summary.classesAwaitingSubmissions}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {copy.observability.cards.teamsOutstanding}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                      <p className="text-sm text-muted-foreground">
                        {copy.observability.cards.ungradedResults}
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {observability.summary.ungradedResults}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {copy.observability.cards.auditEvents24h(
                          observability.summary.auditEventsLast24Hours
                        )}
                      </p>
                    </div>
                  </div>

                  <section className="content-auto motion-fade-up motion-fade-delay-1 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          {copy.observability.roundPressure.title}
                        </h3>
                        <span className="text-xs text-muted-foreground">
                          {copy.observability.roundPressure.updatedAt(
                            formatDate(observability.generatedAt)
                          )}
                        </span>
                      </div>
                      {observability.roundSignals.length > 0 ? (
                        observability.roundSignals.slice(0, 6).map((signal) => (
                          <div
                            key={signal.roundId}
                            className="rounded-2xl border border-border/70 bg-muted/20 p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="font-medium text-foreground">
                                  {signal.className}
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {copy.observability.roundPressure.submitted(
                                    signal.roundNumber,
                                    signal.submittedTeams,
                                    signal.totalTeams
                                  )}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Badge
                                  variant={
                                    signal.roundStatus === "PROCESSING"
                                      ? "default"
                                      : "outline"
                                  }
                                >
                                  {getRoundStatusLabel(locale, signal.roundStatus)}
                                </Badge>
                                {signal.overdue ? (
                                  <Badge variant="destructive">
                                    {copy.observability.roundPressure.overdue}
                                  </Badge>
                                ) : null}
                              </div>
                            </div>
                            <p className="mt-3 text-sm text-muted-foreground">
                              {copy.observability.roundPressure.missingTeams(
                                signal.missingTeams,
                                formatDate(signal.deadline)
                              )}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                          {copy.observability.roundPressure.empty}
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          {copy.observability.gradingBacklog.title}
                        </h3>
                        {observability.gradingSignals.length > 0 ? (
                          observability.gradingSignals.map((signal) => (
                            <div
                              key={signal.classId}
                              className="rounded-2xl border border-border/70 bg-muted/20 p-4"
                            >
                              <p className="font-medium text-foreground">{signal.className}</p>
                              <p className="mt-2 text-sm text-muted-foreground">
                                {copy.observability.gradingBacklog.summary(
                                  signal.ungradedResults,
                                  signal.latestUngradedRound
                                )}
                              </p>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                            {copy.observability.gradingBacklog.empty}
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          {copy.observability.operatorActivity.title}
                        </h3>
                        {observability.auditActions.length > 0 ? (
                          observability.auditActions.map((action) => (
                            <div
                              key={action.action}
                              className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 px-4 py-3"
                            >
                              <span className="text-sm text-foreground">
                                {formatAuditActionLabel(locale, action.action)}
                              </span>
                              <Badge variant="outline">{action.count}</Badge>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                            {copy.observability.operatorActivity.empty}
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                </>
              ) : null}
            </CardContent>
          </Card>

          <section className="content-auto motion-fade-up motion-fade-delay-2 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
            <Card className="border-border/70 bg-background/95 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">{copy.ownership.title}</CardTitle>
                <CardDescription>
                  {copy.ownership.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {teacherLoad.length > 0 ? (
                  teacherLoad.map((owner) => (
                    <div
                      key={owner.id}
                      className="rounded-2xl border border-border/70 bg-muted/20 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{owner.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {getUserRoleLabel(locale, owner.role)} | {owner.email}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {copy.ownership.activeClasses(owner.activeClasses)}
                        </Badge>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                        <span>{copy.ownership.semesters(owner.semesters)}</span>
                        <span>{copy.ownership.classes(owner.classes)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                    {copy.ownership.empty}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-background/95 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">{copy.spotlight.title}</CardTitle>
                <CardDescription>
                  {copy.spotlight.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedClass ? (
                  <>
                    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="font-medium text-foreground">
                            {selectedClass.name}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {selectedClass.semester.name} ({selectedClass.semester.code})
                          </p>
                        </div>
                        <Badge variant="outline">{selectedClassStatusLabel}</Badge>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            {copy.spotlight.owner}
                          </p>
                          <p className="mt-2 font-medium text-foreground">
                            {selectedClass.semester.creator.name ??
                              selectedClass.semester.creator.email}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            {copy.spotlight.joinCode}
                          </p>
                          <p className="mt-2 font-medium text-foreground">
                            {selectedClass.joinCode}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            {copy.spotlight.round}
                          </p>
                          <p className="mt-2 font-medium text-foreground">
                            {selectedClass.currentRound} / {selectedClass.maxRounds}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            {copy.spotlight.teamLoad}
                          </p>
                          <p className="mt-2 font-medium text-foreground">
                            {selectedClass._count.teams} / {selectedClass.maxTeams}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/admin/classes/${selectedClass.id}`}
                      className={cn(buttonVariants({ variant: "outline" }), "w-full gap-2")}
                    >
                      {copy.spotlight.openDetail}
                      <ArrowRight className="size-4" />
                    </Link>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                    {copy.spotlight.empty}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="content-auto motion-fade-up motion-fade-delay-3 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <Card className="border-border/70 bg-background/95 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">{copy.latestClasses.title}</CardTitle>
                <CardDescription>
                  {copy.latestClasses.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {classes.slice(0, 4).map((courseClass) => (
                  <div
                    key={courseClass.id}
                    className={`rounded-2xl border p-4 ${
                      courseClass.id === selectedClassId
                        ? "border-primary/40 bg-primary/5"
                        : "border-border/70 bg-muted/20"
                    }`}
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-foreground">{courseClass.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {courseClass.semester.name} | {copy.latestClasses.owner}{" "}
                            {courseClass.semester.creator.name ??
                              courseClass.semester.creator.email}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {getClassStatusLabel(locale, courseClass.status)}
                        </Badge>
                      </div>
                      <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                        <span>
                          {copy.latestClasses.teams(
                            courseClass._count.teams,
                            courseClass.maxTeams
                          )}
                        </span>
                        <span>{copy.latestClasses.students(courseClass._count.teamMembers)}</span>
                        <span>
                          {copy.latestClasses.rounds(
                            courseClass.currentRound,
                            courseClass.maxRounds
                          )}
                        </span>
                        <span>
                          {copy.latestClasses.createdRounds(courseClass._count.rounds)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                          onClick={() => {
                            setSelectedClassId(courseClass.id);
                          }}
                        >
                          {copy.latestClasses.spotlight}
                        </button>
                        <Link
                          href={`/admin/classes/${courseClass.id}`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                        >
                          {copy.latestClasses.detail}
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-background/95 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">{copy.recentSemesters.title}</CardTitle>
                <CardDescription>
                  {copy.recentSemesters.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {semesters.slice(0, 4).map((semester) => (
                  <div
                    key={semester.id}
                    className="rounded-2xl border border-border/70 bg-muted/20 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{semester.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {semester.code} | {semester.creator.name ?? semester.creator.email}
                          </p>
                        </div>
                      <Badge variant="outline">
                        {getSemesterStatusLabel(locale, semester.status)}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                      <span>
                        {copy.recentSemesters.classes(
                          semester._count.classes,
                          formatDate(semester.startDate)
                        )}
                      </span>
                      <span>{copy.recentSemesters.end(formatDate(semester.endDate))}</span>
                    </div>
                    <Link
                      href={`/admin/classes?semesterId=${semester.id}`}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "mt-3 gap-2"
                      )}
                    >
                      {copy.recentSemesters.openClasses}
                      <ArrowRight className="size-4" />
                    </Link>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
