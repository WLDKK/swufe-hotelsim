"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ChartLoadingSkeleton } from "@/components/layout/chart-loading-skeleton";
import { TeacherWorkspaceHero } from "@/components/teacher/teacher-workspace-hero";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLocale } from "@/i18n/use-locale";
import { getClassStatusLabel } from "@/i18n/status-labels";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { formatCompactCurrency, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const LeaderboardCompareBarChart = dynamic(
  () =>
    import("@/components/dashboard/leaderboard-compare-bar-chart").then(
      (module) => module.LeaderboardCompareBarChart
    ),
  {
    ssr: false,
    loading: () => <ChartLoadingSkeleton className="h-80" />,
  }
);

type TeacherDashboardPanelProps = {
  initialClassId?: string;
};

type ClassListItem = {
  id: string;
  name: string;
  status: string;
  currentRound: number;
  maxRounds: number;
  maxTeams: number;
  semester: {
    id: string;
    name: string;
    code: string;
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

type LeaderboardEntry = {
  teamId: string;
  rankOverall: number;
  totalRevenue: number;
  netProfit: number;
  overallMarketShare: number;
  occupancyRate: number;
  team: {
    id: string;
    name: string;
    hotelName: string;
    color: string;
  };
};

type ClassResultsResponse = {
  roundNumber: number | null;
  availableRoundNumbers: number[];
  leaderboard: LeaderboardEntry[];
  results: Array<{
    id: string;
    teamId: string;
    totalRevenue: number;
    netProfit: number;
  }>;
};

const teacherDashboardCopy = {
  "zh-CN": {
    badgeLabel: "教师 / 总览",
    title: "教学总览与班级运行快照",
    description:
      "这个总览页汇总班级与结果数据，帮助教师在进入轮次处理、班级详情与评分前，先快速判断整体教学负载和重点班级。",
    statusTitle: "教学负载",
    statusBody:
      "待配置、进行中与已完成班级的数量都来自同一套班级数据，因此这里看到的总览与后续操作页保持一致。",
    summaryLabels: {
      classes: "班级",
      inProgress: "进行中",
      teams: "团队",
      students: "学生",
    },
    hints: {
      classes: (setup: number, completed: number) => `待配置 ${setup} | 已完成 ${completed}`,
      inProgress: "当前处于模拟循环中的班级数量。",
      teams: "当前可访问班级下的团队总数。",
      students: "教师名下已编组学生总数。",
    },
    actions: {
      semesters: "打开学期",
      classes: "打开班级",
      simulation: "打开模拟",
      grading: "打开评分",
    },
    statusMixTitle: "班级状态分布",
    statusMixDescription: "快速查看当前教师名下班级处于待配置、进行中还是已完成阶段。",
    statusMixLabels: {
      setup: "待配置",
      active: "进行中",
      completed: "已完成",
    },
    loadingCard: "正在加载教师总览数据...",
    genericError: "教师总览加载失败。",
    emptyState:
      "当前还没有可用班级。请先创建学期和班级，再回来查看教师总览。",
    classesTitle: "班级一览",
    classesDescription:
      "从这里可以快速聚焦某个班级，然后继续进入详情、模拟处理或评分页面。",
    classMeta: {
      round: "轮次",
      teams: "团队",
      students: "学生",
      spotlight: "聚焦",
      detail: "详情",
      simulation: "模拟",
      grading: "评分",
    },
    spotlightTitle: "聚焦班级",
    spotlightDescription:
      "聚焦区会把班级基础信息与最新排行榜结果组合在一起，便于快速判断当前教学重点。",
    spotlightCards: {
      round: "轮次",
      teams: "团队",
      students: "学生",
    },
    leaderboardLoading: "正在加载最新排行榜...",
    leaderboardError: "聚焦班级排行榜加载失败。",
    latestCompletedRound: "最近已完成轮次",
    comparisonLabel: "收入与利润对比",
    comparisonTitle: (count: number) => `最新排行榜前 ${count} 支团队`,
    comparisonPlotted: (count: number) => `${count} 条数据`,
    comparisonEmpty:
      "首个已处理排行榜出现后，这里会自动显示收入与利润对比图。",
    marketShare: "市场份额",
    revenue: "收入",
    profit: "利润",
    occupancy: "入住率",
    noResults: "这个班级暂时还没有已处理结果。",
  },
  "en-US": {
    badgeLabel: "Teacher / Dashboard",
    title: "Teaching overview across live classes",
    description:
      "This dashboard summarizes class and result data so instructors can judge workload and spotlight classes before moving into detail, simulation, or grading.",
    statusTitle: "Teaching load",
    statusBody:
      "Setup, active, and completed counts all come from the same class data source, keeping this overview aligned with downstream teacher operations.",
    summaryLabels: {
      classes: "Classes",
      inProgress: "In progress",
      teams: "Teams",
      students: "Students",
    },
    hints: {
      classes: (setup: number, completed: number) => `Setup ${setup} | Completed ${completed}`,
      inProgress: "Classes currently inside the simulation loop.",
      teams: "Total teams across accessible classes.",
      students: "Current rostered learners across teacher-owned classes.",
    },
    actions: {
      semesters: "Open semesters",
      classes: "Open classes",
      simulation: "Open simulation",
      grading: "Open grading",
    },
    statusMixTitle: "Status mix",
    statusMixDescription:
      "Quickly inspect how many classes are in setup, active, or completed state.",
    statusMixLabels: {
      setup: "Setup",
      active: "Active",
      completed: "Completed",
    },
    loadingCard: "Loading teacher dashboard data...",
    genericError: "Failed to load class summaries.",
    emptyState:
      "No classes exist yet. Create a semester and class first to activate the teacher dashboard.",
    classesTitle: "Classes at a glance",
    classesDescription:
      "Use these shortcuts to spotlight a class and jump into detail, simulation, or grading.",
    classMeta: {
      round: "Round",
      teams: "Teams",
      students: "Students",
      spotlight: "Spotlight",
      detail: "Detail",
      simulation: "Simulation",
      grading: "Grading",
    },
    spotlightTitle: "Spotlight class",
    spotlightDescription:
      "The spotlight combines class metadata with the latest leaderboard snapshot.",
    spotlightCards: {
      round: "Round",
      teams: "Teams",
      students: "Students",
    },
    leaderboardLoading: "Loading latest leaderboard...",
    leaderboardError: "Failed to load the spotlight leaderboard.",
    latestCompletedRound: "Latest completed round",
    comparisonLabel: "Revenue and profit comparison",
    comparisonTitle: (count: number) => `Top ${count} teams in the latest leaderboard`,
    comparisonPlotted: (count: number) => `${count} plotted`,
    comparisonEmpty:
      "The comparison chart will appear after the first processed leaderboard is available.",
    marketShare: "Market share",
    revenue: "Revenue",
    profit: "Profit",
    occupancy: "Occupancy",
    noResults: "No processed results are available for this class yet.",
  },
} as const;

export function TeacherDashboardPanel({
  initialClassId,
}: TeacherDashboardPanelProps) {
  const { locale } = useLocale();
  const copy = teacherDashboardCopy[locale];
  const [selectedClassId, setSelectedClassId] = useState(initialClassId ?? "");

  const classesQuery = useQuery({
    queryKey: ["teacher-dashboard-classes"],
    queryFn: () => apiFetch<ClassesResponse>("/api/classes"),
  });

  const classes = useMemo(
    () => classesQuery.data?.classes ?? [],
    [classesQuery.data?.classes]
  );

  useEffect(() => {
    if (initialClassId) {
      setSelectedClassId(initialClassId);
      return;
    }

    // Default the spotlight panel to the first accessible class so teachers
    // land on a meaningful overview without needing an extra click first.
    if (!selectedClassId && classes.length > 0) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, initialClassId, selectedClassId]);

  const resultsQuery = useQuery({
    queryKey: ["teacher-dashboard-results", selectedClassId],
    queryFn: () =>
      apiFetch<ClassResultsResponse>(
        `/api/simulation/results?classId=${selectedClassId}`
      ),
    enabled: Boolean(selectedClassId),
    placeholderData: keepPreviousData,
  });

  const selectedClass =
    classes.find((courseClass) => courseClass.id === selectedClassId) ?? null;

  // The spotlight chart intentionally reads from the same leaderboard payload
  // that powers the summary cards so the Stage 7 delivery baseline does not
  // introduce a second teacher-only data path to maintain.
  const leaderboardCompareData = useMemo(
    () =>
      (resultsQuery.data?.leaderboard ?? []).slice(0, 5).map((entry) => ({
        teamName: entry.team.name,
        totalRevenue: entry.totalRevenue,
        netProfit: entry.netProfit,
      })),
    [resultsQuery.data?.leaderboard]
  );
  const spotlightLeaders = useMemo(
    () => (resultsQuery.data?.leaderboard ?? []).slice(0, 3),
    [resultsQuery.data?.leaderboard]
  );
  const formatRoundLabel = (roundNumber: number) =>
    locale === "zh-CN" ? `第 ${roundNumber} 轮` : `Round ${roundNumber}`;

  const totals = useMemo(
    () => ({
      classes: classes.length,
      setup: classes.filter((courseClass) => courseClass.status === "SETUP").length,
      active: classes.filter((courseClass) => courseClass.status === "IN_PROGRESS").length,
      completed: classes.filter((courseClass) => courseClass.status === "COMPLETED").length,
      teams: classes.reduce((sum, courseClass) => sum + courseClass._count.teams, 0),
      students: classes.reduce(
        (sum, courseClass) => sum + courseClass._count.teamMembers,
        0
      ),
    }),
    [classes]
  );

  return (
    <div className="flex flex-col gap-6">
      <TeacherWorkspaceHero
        badgeLabel={copy.badgeLabel}
        title={copy.title}
        description={copy.description}
        statusTitle={copy.statusTitle}
        statusBody={copy.statusBody}
        summaryItems={[
          {
            label: copy.summaryLabels.classes,
            value: String(totals.classes),
            hint: copy.hints.classes(totals.setup, totals.completed),
          },
          {
            label: copy.summaryLabels.inProgress,
            value: String(totals.active),
            hint: copy.hints.inProgress,
          },
          {
            label: copy.summaryLabels.teams,
            value: String(totals.teams),
            hint: copy.hints.teams,
          },
          {
            label: copy.summaryLabels.students,
            value: String(totals.students),
            hint: copy.hints.students,
          },
        ]}
        actions={[
          { href: "/teacher/semesters", label: copy.actions.semesters, variant: "default" },
          { href: "/teacher/classes", label: copy.actions.classes },
          { href: "/teacher/simulation", label: copy.actions.simulation },
          { href: "/teacher/grading", label: copy.actions.grading },
        ]}
      />

      <Card className="border-white/10 bg-white/[0.035] shadow-[0_30px_70px_-42px_rgba(2,6,23,0.88)]">
        <CardHeader>
          <CardTitle className="text-xl">{copy.statusMixTitle}</CardTitle>
          <CardDescription>
            {copy.statusMixDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-sm text-muted-foreground">{copy.statusMixLabels.setup}</p>
            <p className="mt-2 text-xl font-semibold">{totals.setup}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-sm text-muted-foreground">{copy.statusMixLabels.active}</p>
            <p className="mt-2 text-xl font-semibold">{totals.active}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-sm text-muted-foreground">{copy.statusMixLabels.completed}</p>
            <p className="mt-2 text-xl font-semibold">{totals.completed}</p>
          </div>
        </CardContent>
      </Card>

      {classesQuery.isLoading ? (
        <Card className="border-white/10 bg-white/[0.035] shadow-[0_30px_70px_-42px_rgba(2,6,23,0.88)]">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {copy.loadingCard}
          </CardContent>
        </Card>
      ) : classesQuery.error ? (
        <Card className="border-destructive/30 bg-destructive/[0.06] shadow-[0_30px_70px_-42px_rgba(2,6,23,0.88)]">
          <CardContent className="p-6 text-sm text-destructive">
            {classesQuery.error instanceof ApiClientError
              ? classesQuery.error.message
              : copy.genericError}
          </CardContent>
        </Card>
      ) : classes.length === 0 ? (
        <Card className="border-white/10 bg-white/[0.035] shadow-[0_30px_70px_-42px_rgba(2,6,23,0.88)]">
          <CardContent className="p-6 text-sm text-muted-foreground">
            {copy.emptyState}
          </CardContent>
        </Card>
      ) : (
        <section className="content-auto motion-fade-up motion-fade-delay-1 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
          <Card className="border-white/10 bg-white/[0.035] shadow-[0_30px_70px_-42px_rgba(2,6,23,0.88)]">
            <CardHeader>
              <CardTitle className="text-xl">{copy.classesTitle}</CardTitle>
              <CardDescription>
                {copy.classesDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {classes.map((courseClass) => (
                <div
                  key={courseClass.id}
                  className={`rounded-2xl border p-4 ${
                    courseClass.id === selectedClassId
                      ? "border-primary/35 bg-primary/10 shadow-[0_24px_48px_-30px_rgba(14,165,233,0.38)]"
                      : "border-white/10 bg-white/[0.035]"
                  }`}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">{courseClass.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {courseClass.semester.name} | {copy.classMeta.round} {courseClass.currentRound} /{" "}
                          {courseClass.maxRounds}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {getClassStatusLabel(locale, courseClass.status)}
                      </Badge>
                    </div>
                    <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                      <span>
                        {copy.classMeta.teams} {courseClass._count.teams} / {courseClass.maxTeams}
                      </span>
                      <span>{copy.classMeta.students} {courseClass._count.teamMembers}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                        onClick={() => {
                          setSelectedClassId(courseClass.id);
                        }}
                      >
                        {copy.classMeta.spotlight}
                      </button>
                      <Link
                        href={`/teacher/classes/${courseClass.id}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        {copy.classMeta.detail}
                      </Link>
                      <Link
                        href={`/teacher/simulation?classId=${courseClass.id}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        {copy.classMeta.simulation}
                      </Link>
                      <Link
                        href={`/teacher/grading?classId=${courseClass.id}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        {copy.classMeta.grading}
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/[0.035] shadow-[0_30px_70px_-42px_rgba(2,6,23,0.88)]">
            <CardHeader>
              <CardTitle className="text-xl">{copy.spotlightTitle}</CardTitle>
              <CardDescription>
                {copy.spotlightDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedClass ? (
                <>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-medium text-foreground">{selectedClass.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {selectedClass.semester.name} ({selectedClass.semester.code})
                        </p>
                      </div>
                      <Badge variant="outline">
                        {getClassStatusLabel(locale, selectedClass.status)}
                      </Badge>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          {copy.spotlightCards.round}
                        </p>
                        <p className="mt-2 font-medium text-foreground">
                          {selectedClass.currentRound} / {selectedClass.maxRounds}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          {copy.spotlightCards.teams}
                        </p>
                        <p className="mt-2 font-medium text-foreground">
                          {selectedClass._count.teams}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          {copy.spotlightCards.students}
                        </p>
                        <p className="mt-2 font-medium text-foreground">
                          {selectedClass._count.teamMembers}
                        </p>
                      </div>
                    </div>
                  </div>

                  {resultsQuery.isLoading ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-muted-foreground">
                      {copy.leaderboardLoading}
                    </div>
                  ) : resultsQuery.error ? (
                    <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                      {resultsQuery.error instanceof ApiClientError
                        ? resultsQuery.error.message
                        : copy.leaderboardError}
                    </div>
                  ) : resultsQuery.data?.roundNumber ? (
                    <>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm text-muted-foreground">
                          {copy.latestCompletedRound}
                        </p>
                        <p className="mt-2 text-2xl font-semibold">
                          {formatRoundLabel(resultsQuery.data.roundNumber)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm text-muted-foreground">
                              {copy.comparisonLabel}
                            </p>
                            <p className="mt-1 text-lg font-semibold text-foreground">
                              {copy.comparisonTitle(leaderboardCompareData.length)}
                            </p>
                          </div>
                          <Badge variant="outline">
                            {copy.comparisonPlotted(leaderboardCompareData.length)}
                          </Badge>
                        </div>
                        {leaderboardCompareData.length > 0 ? (
                          <LeaderboardCompareBarChart data={leaderboardCompareData} />
                        ) : (
                          <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">
                            {copy.comparisonEmpty}
                          </div>
                        )}
                      </div>
                      {spotlightLeaders.map((entry) => (
                        <div
                          key={entry.teamId}
                          className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-foreground">
                                #{entry.rankOverall} {entry.team.name}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {entry.team.hotelName}
                              </p>
                            </div>
                            <Badge variant="outline">
                              {copy.marketShare} {formatPercent(entry.overallMarketShare)}
                            </Badge>
                          </div>
                          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                            <span>
                              {copy.revenue} {formatCompactCurrency(entry.totalRevenue)} | {copy.profit}{" "}
                              {formatCompactCurrency(entry.netProfit)}
                            </span>
                            <span>
                              {copy.occupancy} {formatPercent(entry.occupancyRate)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">
                      {copy.noResults}
                    </div>
                  )}
                </>
              ) : null}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
