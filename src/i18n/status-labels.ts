import type { SupportedLocale } from "@/i18n/messages";

const classStatusLabels: Record<SupportedLocale, Record<string, string>> = {
  "zh-CN": {
    SETUP: "\u5f85\u914d\u7f6e",
    IN_PROGRESS: "\u8fdb\u884c\u4e2d",
    COMPLETED: "\u5df2\u5b8c\u6210",
  },
  "en-US": {
    SETUP: "Setup",
    IN_PROGRESS: "In progress",
    COMPLETED: "Completed",
  },
};

const roundStatusLabels: Record<SupportedLocale, Record<string, string>> = {
  "zh-CN": {
    PENDING: "\u5f85\u5904\u7406",
    PROCESSING: "\u5904\u7406\u4e2d",
    COMPLETED: "\u5df2\u5904\u7406",
  },
  "en-US": {
    PENDING: "Pending",
    PROCESSING: "Processing",
    COMPLETED: "Completed",
  },
};

const decisionStatusLabels: Record<SupportedLocale, Record<string, string>> = {
  "zh-CN": {
    NOT_STARTED: "\u672a\u5f00\u59cb",
    DRAFT: "\u8349\u7a3f",
    SUBMITTED: "\u5df2\u63d0\u4ea4",
    LOCKED: "\u5df2\u9501\u5b9a",
  },
  "en-US": {
    NOT_STARTED: "Not started",
    DRAFT: "Draft",
    SUBMITTED: "Submitted",
    LOCKED: "Locked",
  },
};

const semesterStatusLabels: Record<SupportedLocale, Record<string, string>> = {
  "zh-CN": {
    DRAFT: "\u8349\u7a3f",
    ACTIVE: "\u8fdb\u884c\u4e2d",
    COMPLETED: "\u5df2\u5b8c\u6210",
    ARCHIVED: "\u5df2\u5f52\u6863",
  },
  "en-US": {
    DRAFT: "Draft",
    ACTIVE: "Active",
    COMPLETED: "Completed",
    ARCHIVED: "Archived",
  },
};

const userRoleLabels: Record<SupportedLocale, Record<string, string>> = {
  "zh-CN": {
    STUDENT: "\u5b66\u751f",
    TEACHER: "\u6559\u5e08",
    JUDGE: "\u88c1\u5224",
    SPECTATOR: "\u89c2\u8d5b",
    ADMIN: "\u7ba1\u7406\u5458",
  },
  "en-US": {
    STUDENT: "Student",
    TEACHER: "Teacher",
    JUDGE: "Judge",
    SPECTATOR: "Spectator",
    ADMIN: "Admin",
  },
};

const teamMemberRoleLabels: Record<SupportedLocale, Record<string, string>> = {
  "zh-CN": {
    LEADER: "\u961f\u957f",
    MEMBER: "\u6210\u5458",
  },
  "en-US": {
    LEADER: "Leader",
    MEMBER: "Member",
  },
};

function resolveLabel(
  labels: Record<SupportedLocale, Record<string, string>>,
  locale: SupportedLocale,
  value: string | null | undefined
) {
  if (!value) {
    return "-";
  }

  return labels[locale][value] ?? value;
}

export function getClassStatusLabel(
  locale: SupportedLocale,
  status: string | null | undefined
) {
  return resolveLabel(classStatusLabels, locale, status);
}

export function getRoundStatusLabel(
  locale: SupportedLocale,
  status: string | null | undefined
) {
  return resolveLabel(roundStatusLabels, locale, status);
}

export function getDecisionStatusLabel(
  locale: SupportedLocale,
  status: string | null | undefined
) {
  return resolveLabel(decisionStatusLabels, locale, status);
}

export function getSemesterStatusLabel(
  locale: SupportedLocale,
  status: string | null | undefined
) {
  return resolveLabel(semesterStatusLabels, locale, status);
}

export function getUserRoleLabel(
  locale: SupportedLocale,
  role: string | null | undefined
) {
  return resolveLabel(userRoleLabels, locale, role);
}

export function getTeamMemberRoleLabel(
  locale: SupportedLocale,
  role: string | null | undefined
) {
  return resolveLabel(teamMemberRoleLabels, locale, role);
}
