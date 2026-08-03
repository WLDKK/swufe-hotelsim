"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Building2,
  GraduationCap,
  Home,
  ShieldCheck,
  Telescope,
  type LucideIcon,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { WorkspaceNav, type WorkspaceNavItem } from "@/components/layout/workspace-nav";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { SupportedLocale } from "@/i18n/messages";
import { useLocale } from "@/i18n/use-locale";
import { cn } from "@/lib/utils";

type WorkspaceRole = "student" | "teacher" | "admin";

type WorkspaceShellProps = {
  role: WorkspaceRole;
  userName: string;
  userEmail: string;
  navItems: WorkspaceNavItem[];
  children: React.ReactNode;
};

type WorkspaceTheme = {
  icon: LucideIcon;
  panelClassName: string;
  badgeClassName: string;
  iconClassName: string;
  activeNavClassName: string;
  inactiveNavClassName: string;
  summaryCardClassName: string;
  headerGlowClassName: string;
};

type RoleCopy = {
  badgeLabel: string;
  title: string;
  description: string;
  headerDescription: string;
  navLabelsByHref: Record<string, string>;
  summaryItems: Array<{
    label: string;
    value: string;
    hint: string;
  }>;
};

const shellCopy: Record<
  SupportedLocale,
  {
    brand: string;
    platformLabel: string;
    backHome: string;
    signOut: string;
    currentRoleLabel: string;
    currentUserLabel: string;
    roleLabels: Record<WorkspaceRole, string>;
    roles: Record<WorkspaceRole, RoleCopy>;
  }
> = {
  "zh-CN": {
    brand: "SWUFE HotelSim",
    platformLabel: "酒店经营模拟课程平台",
    backHome: "返回首页",
    signOut: "退出登录",
    currentRoleLabel: "当前身份",
    currentUserLabel: "当前账号",
    roleLabels: {
      student: "学生端",
      teacher: "教师端",
      admin: "管理端",
    },
    roles: {
      student: {
        badgeLabel: "学生工作区",
        title: "经营决策工作台",
        description:
          "聚合团队状态、轮次推进、结果复盘与班级排名，帮助团队在一次实验中形成完整的经营闭环。",
        headerDescription:
          "当前账号已连接课程数据。你可以在总览、团队、决策、结果、排名与加入班级之间切换，系统会持续保留同一支队伍的实验上下文。",
        navLabelsByHref: {
          "/student/dashboard": "总览",
          "/student/team": "团队",
          "/student/decisions": "决策",
          "/student/results": "结果",
          "/student/rankings": "排名",
          "/student/join": "加入班级",
        },
        summaryItems: [
          {
            label: "当前任务",
            value: "提交决策",
            hint: "围绕价格、营销、渠道、运营与融资完成本轮方案。",
          },
          {
            label: "核心信号",
            value: "结果复盘",
            hint: "随时对照上一轮结果，判断当前策略是否需要调整。",
          },
          {
            label: "班级环境",
            value: "排名对照",
            hint: "通过班级排名理解本队与其他团队的差距与机会。",
          },
        ],
      },
      teacher: {
        badgeLabel: "教师工作区",
        title: "教学运营中台",
        description:
          "围绕学期、班级、模拟运行与评分反馈组织课程，让教学过程更清晰、可追踪、可复盘。",
        headerDescription:
          "当前教师账号已连接班级与结果数据。你可以从这里统一查看课堂状态，并继续进入学期、班级、模拟和评分相关页面。",
        navLabelsByHref: {
          "/teacher/dashboard": "总览",
          "/teacher/semesters": "学期管理",
          "/teacher/classes": "班级管理",
          "/teacher/simulation": "模拟处理",
          "/teacher/grading": "评分反馈",
        },
        summaryItems: [
          {
            label: "教学组织",
            value: "学期与班级",
            hint: "统一掌握课程配置、班级进度与团队编组情况。",
          },
          {
            label: "实验推进",
            value: "轮次处理",
            hint: "快速判断哪些班级适合初始化、处理或进入结果复盘。",
          },
          {
            label: "教学闭环",
            value: "评分反馈",
            hint: "将结果、点评与评分收束在同一条教学链路中。",
          },
        ],
      },
      admin: {
        badgeLabel: "管理工作区",
        title: "平台治理中台",
        description:
          "负责用户治理、班级学期配置、roster 维护与平台运营支持，为长期运行与后续接手预留稳定基础。",
        headerDescription:
          "当前管理账号已连接平台后台数据。你可以从这里继续处理用户、学期、班级与平台治理事务，保持实验环境稳定可控。",
        navLabelsByHref: {
          "/admin/dashboard": "总览",
          "/admin/users": "用户管理",
          "/admin/semesters": "学期管理",
          "/admin/classes": "班级管理",
        },
        summaryItems: [
          {
            label: "治理重点",
            value: "用户权限",
            hint: "统一管理账号角色、访问边界与状态变更。",
          },
          {
            label: "数据完整性",
            value: "Roster 维护",
            hint: "保障批量导入、班级分配与团队映射长期可追踪。",
          },
          {
            label: "平台运行",
            value: "环境稳定",
            hint: "为课程演示、实验运行与后续交接提供可靠支撑。",
          },
        ],
      },
    },
  },
  "en-US": {
    brand: "SWUFE HotelSim",
    platformLabel: "Hotel management simulation platform",
    backHome: "Back to home",
    signOut: "Sign out",
    currentRoleLabel: "Current role",
    currentUserLabel: "Current account",
    roleLabels: {
      student: "Student",
      teacher: "Teacher",
      admin: "Admin",
    },
    roles: {
      student: {
        badgeLabel: "Student workspace",
        title: "Decision operations desk",
        description:
          "Keep team status, round progress, results review, and rankings in one decision-oriented learning surface.",
        headerDescription:
          "This account is connected to the live student workflow. Move between dashboard, team, decisions, results, rankings, and class join while keeping the same team context.",
        navLabelsByHref: {
          "/student/dashboard": "Dashboard",
          "/student/team": "Team",
          "/student/decisions": "Decisions",
          "/student/results": "Results",
          "/student/rankings": "Rankings",
          "/student/join": "Join class",
        },
        summaryItems: [
          {
            label: "Priority",
            value: "Submit decisions",
            hint: "Complete pricing, marketing, channels, operating, and financing choices for the round.",
          },
          {
            label: "Signal",
            value: "Results review",
            hint: "Compare the latest processed output before adjusting the next plan.",
          },
          {
            label: "Context",
            value: "Class ranking",
            hint: "Read the leaderboard to understand how your team compares with peers.",
          },
        ],
      },
      teacher: {
        badgeLabel: "Teacher workspace",
        title: "Teaching operations hub",
        description:
          "Manage semesters, classes, simulation runs, and grading from one teaching-facing operating surface.",
        headerDescription:
          "This teacher account is connected to live class and results data. Use the shared shell to move into semesters, classes, simulation, and grading with consistent context.",
        navLabelsByHref: {
          "/teacher/dashboard": "Dashboard",
          "/teacher/semesters": "Semesters",
          "/teacher/classes": "Classes",
          "/teacher/simulation": "Simulation",
          "/teacher/grading": "Grading",
        },
        summaryItems: [
          {
            label: "Instruction",
            value: "Semester and classes",
            hint: "Track configuration, class status, and team distribution in one place.",
          },
          {
            label: "Operations",
            value: "Round handling",
            hint: "See which classes should initialize, process, or move into review.",
          },
          {
            label: "Closure",
            value: "Feedback loop",
            hint: "Keep scoring and comments aligned with simulation outcomes.",
          },
        ],
      },
      admin: {
        badgeLabel: "Admin workspace",
        title: "Platform governance hub",
        description:
          "Maintain users, classes, semesters, roster integrity, and operational readiness from one management surface.",
        headerDescription:
          "This admin account is connected to the live governance layer. Continue into user, semester, and class management while preserving a consistent operating context.",
        navLabelsByHref: {
          "/admin/dashboard": "Dashboard",
          "/admin/users": "Users",
          "/admin/semesters": "Semesters",
          "/admin/classes": "Classes",
        },
        summaryItems: [
          {
            label: "Governance",
            value: "Access control",
            hint: "Manage role ownership, account state, and platform boundaries.",
          },
          {
            label: "Integrity",
            value: "Roster quality",
            hint: "Protect imports, team mapping, and class preparation before launch.",
          },
          {
            label: "Readiness",
            value: "Stable delivery",
            hint: "Support live demos, experiments, and future handoff with a reliable base.",
          },
        ],
      },
    },
  },
};

const workspaceThemes: Record<WorkspaceRole, WorkspaceTheme> = {
  student: {
    icon: GraduationCap,
    panelClassName:
      "border-amber-400/15 bg-[linear-gradient(180deg,rgba(8,14,24,0.96),rgba(18,12,20,0.94))]",
    badgeClassName:
      "border-amber-400/20 bg-amber-300/10 text-amber-100 hover:bg-amber-300/10",
    iconClassName:
      "border-amber-400/20 bg-amber-300/10 text-amber-100 shadow-[0_18px_40px_-26px_rgba(245,158,11,0.55)]",
    activeNavClassName:
      "border-amber-400/30 bg-[linear-gradient(135deg,rgba(245,158,11,0.82),rgba(234,88,12,0.78))] text-white shadow-[0_24px_44px_-28px_rgba(245,158,11,0.62)] hover:brightness-110",
    inactiveNavClassName:
      "border-white/10 bg-white/5 text-slate-200 hover:border-amber-400/25 hover:bg-white/8",
    summaryCardClassName: "border-white/10 bg-white/5",
    headerGlowClassName: "from-amber-400/12 via-transparent to-rose-400/10",
  },
  teacher: {
    icon: Telescope,
    panelClassName:
      "border-sky-400/15 bg-[linear-gradient(180deg,rgba(7,14,24,0.96),rgba(8,22,34,0.94))]",
    badgeClassName:
      "border-sky-400/20 bg-sky-300/10 text-sky-100 hover:bg-sky-300/10",
    iconClassName:
      "border-sky-400/20 bg-sky-300/10 text-sky-100 shadow-[0_18px_40px_-26px_rgba(14,165,233,0.56)]",
    activeNavClassName:
      "border-sky-400/30 bg-[linear-gradient(135deg,rgba(14,165,233,0.78),rgba(37,99,235,0.76))] text-white shadow-[0_24px_44px_-28px_rgba(14,165,233,0.62)] hover:brightness-110",
    inactiveNavClassName:
      "border-white/10 bg-white/5 text-slate-200 hover:border-sky-400/25 hover:bg-white/8",
    summaryCardClassName: "border-white/10 bg-white/5",
    headerGlowClassName: "from-sky-400/12 via-transparent to-cyan-300/10",
  },
  admin: {
    icon: ShieldCheck,
    panelClassName:
      "border-slate-300/15 bg-[linear-gradient(180deg,rgba(8,13,23,0.96),rgba(17,16,24,0.94))]",
    badgeClassName:
      "border-slate-300/20 bg-slate-200/10 text-slate-100 hover:bg-slate-200/10",
    iconClassName:
      "border-slate-300/20 bg-slate-200/10 text-slate-100 shadow-[0_18px_40px_-26px_rgba(148,163,184,0.36)]",
    activeNavClassName:
      "border-slate-300/30 bg-[linear-gradient(135deg,rgba(71,85,105,0.84),rgba(30,41,59,0.86))] text-white shadow-[0_24px_44px_-28px_rgba(15,23,42,0.65)] hover:brightness-110",
    inactiveNavClassName:
      "border-white/10 bg-white/5 text-slate-200 hover:border-slate-300/25 hover:bg-white/8",
    summaryCardClassName: "border-white/10 bg-white/5",
    headerGlowClassName: "from-slate-300/10 via-transparent to-amber-300/10",
  },
};

export function WorkspaceShell({
  role,
  userName,
  userEmail,
  navItems,
  children,
}: WorkspaceShellProps) {
  const { locale } = useLocale();
  const copy = shellCopy[locale];
  const roleCopy = copy.roles[role];
  const theme = workspaceThemes[role];
  const Icon = theme.icon;

  // Centralize role-specific shell colors here so future visual refreshes can
  // restyle the student / teacher / admin surfaces without touching page logic.
  const localizedNavItems = useMemo(
    () =>
      navItems.map((item) => ({
        ...item,
        label: roleCopy.navLabelsByHref[item.href] ?? item.label,
      })),
    [navItems, roleCopy.navLabelsByHref]
  );

  return (
    <section className="mx-auto grid w-full max-w-[92rem] gap-5 px-4 py-4 sm:px-6 sm:py-6 xl:grid-cols-[19rem_minmax(0,1fr)] xl:gap-6 xl:px-8 2xl:px-10">
      <aside className="motion-fade-up self-start xl:sticky xl:top-4">
        <div
          className={cn(
            "surface-sheen overflow-hidden rounded-[2rem] border shadow-[0_32px_90px_-50px_rgba(2,6,23,0.8)] backdrop-blur-xl",
            theme.panelClassName
          )}
        >
          <div className="space-y-6 p-6">
            <div className="space-y-4">
              <Link
                href="/"
                className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm font-medium text-slate-100 shadow-[0_14px_30px_-18px_rgba(15,23,42,0.75)] transition hover:border-sky-300/20 hover:bg-white/10"
              >
                <Building2 className="size-4" />
                <span>{copy.brand}</span>
              </Link>
              <div className="space-y-3">
                <Badge className={cn("rounded-full border", theme.badgeClassName)}>
                  {roleCopy.badgeLabel}
                </Badge>
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "flex size-12 shrink-0 items-center justify-center rounded-[1rem] border shadow-sm",
                      theme.iconClassName
                    )}
                  >
                    <Icon aria-hidden="true" className="size-6" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-400">
                      {copy.platformLabel}
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight text-white">
                      {roleCopy.title}
                    </h1>
                    <p className="text-sm leading-7 text-slate-300">
                      {roleCopy.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Shared navigation stays centralized so route-label changes and
                active-state behavior remain consistent across all role shells. */}
            <WorkspaceNav
              items={localizedNavItems}
              activeClassName={theme.activeNavClassName}
              inactiveClassName={theme.inactiveNavClassName}
            />

            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
              {roleCopy.summaryItems.map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    "interactive-lift rounded-[1.5rem] border p-4",
                    theme.summaryCardClassName
                  )}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-2 text-base font-semibold text-white">
                    {item.value}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-300">
                    {item.hint}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <div className="space-y-6">
        <header className="surface-sheen motion-fade-up motion-fade-delay-1 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/60 shadow-[0_32px_90px_-50px_rgba(2,6,23,0.8)] backdrop-blur-xl">
          <div
            className={cn(
              "bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6",
              theme.headerGlowClassName
            )}
          >
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge
                    variant="secondary"
                    className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-slate-100"
                  >
                    {copy.currentRoleLabel}: {copy.roleLabels[role]}
                  </Badge>
                  <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    {copy.platformLabel}
                  </span>
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-semibold tracking-tight text-white">
                    {userName}
                  </h2>
                  <p className="text-sm text-slate-300">
                    {copy.currentUserLabel}: {userEmail}
                  </p>
                  <p className="max-w-3xl text-sm leading-7 text-slate-300">
                    {roleCopy.headerDescription}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row xl:min-w-[11rem] xl:flex-col">
                <Link
                  href="/"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "gap-2 border-white/10 bg-white/6 text-slate-100 hover:bg-white/10"
                  )}
                >
                  <Home aria-hidden="true" className="size-4" />
                  <span>{copy.backHome}</span>
                </Link>
                <SignOutButton
                  className="border-white/10 bg-white/6 text-slate-100 hover:bg-white/10"
                  label={copy.signOut}
                />
              </div>
            </div>
          </div>
        </header>

        <div className="space-y-6 pb-4">{children}</div>
      </div>
    </section>
  );
}
