"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ChartLoadingSkeleton } from "@/components/layout/chart-loading-skeleton";
import { ResultExplanationCards } from "@/components/results/result-explanation-cards";
import { StudentWorkspaceHero } from "@/components/student/student-workspace-hero";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/lib/formatters";
import { useLocale } from "@/i18n/use-locale";
import { getClassStatusLabel } from "@/i18n/status-labels";

const PerformanceHistoryChart = dynamic(
  () =>
    import("@/components/results/performance-history-chart").then(
      (module) => module.PerformanceHistoryChart
    ),
  {
    ssr: false,
    loading: () => <ChartLoadingSkeleton className="h-72" />,
  }
);

type StudentResultsPanelProps = {
  workspace: {
    team: {
      id: string;
      name: string;
      hotelName: string;
      color: string;
    };
    courseClass: {
      id: string;
      name: string;
      status: string;
      currentRound: number;
      maxRounds: number;
      semester: {
        id: string;
        name: string;
        code: string;
      };
    };
  };
};

type TeamResultItem = {
  id: string;
  roundNumber: number;
  rankOverall: number;
  rankRevenue: number;
  rankProfit: number;
  occupancyRate: number;
  adr: number;
  revpar: number;
  totalRevenue: number;
  netProfit: number;
  overallMarketShare: number;
  cashBalanceEnd: number;
  totalDebtEnd: number;
  guestSatisfactionEnd: number;
  esgScoreEnd: number;
  systemScore: number;
  teacherScore: number | null;
  teacherComment: string | null;
  explanationLog?: Record<string, unknown> | null;
  round: {
    id: string;
    roundNumber: number;
    status: string;
    processedAt: string | null;
  };
  team: {
    id: string;
    name: string;
    hotelName: string;
    color: string;
  };
};

type TeamResultsResponse = {
  latestResult: TeamResultItem | null;
  results: TeamResultItem[];
};

export function StudentResultsPanel({
  workspace,
}: StudentResultsPanelProps) {
  const { locale, messages } = useLocale();
  const copy = messages.studentResults;
  const resultsDescription =
    locale === "zh-CN"
      ? "这个页面直接读取团队结果数据，让学生能够逐轮回顾盈利能力、经营表现与教师反馈。"
      : "This page reads live team results so students can review profitability, operating performance, and teacher feedback round by round.";
  const classStatusLabel = getClassStatusLabel(locale, workspace.courseClass.status);
  const formatRoundLabel = (roundNumber: number) =>
    locale === "zh-CN" ? `第 ${roundNumber} 轮` : `Round ${roundNumber}`;

  const resultsQuery = useQuery({
    queryKey: ["student-team-results", workspace.team.id],
    queryFn: () =>
      apiFetch<TeamResultsResponse>(
        `/api/simulation/results?teamId=${workspace.team.id}`
      ),
  });

  const resultsAscending = useMemo(
    () =>
      [...(resultsQuery.data?.results ?? [])].sort(
        (left, right) => left.roundNumber - right.roundNumber
      ),
    [resultsQuery.data?.results]
  );

  // Prefer the canonical API summary when it exists, but fall back to the last
  // sorted result so the UI still renders correctly if the backend summary is
  // temporarily absent during future refactors.
  const latestResult =
    resultsQuery.data?.latestResult ??
    resultsAscending[resultsAscending.length - 1] ??
    null;

  return (
    <div className="flex flex-col gap-6">
      <StudentWorkspaceHero
        badgeLabel={copy.badgeLabel}
        title={`${copy.titlePrefix} ${workspace.team.name}`}
        description={resultsDescription}
        statusTitle={copy.statusTitle}
        statusBody={
          latestResult
            ? `${formatRoundLabel(latestResult.roundNumber)} ${copy.latestStatusSuffix}`
            : copy.emptyStatus
        }
        summaryItems={[
          {
            label: copy.classLabel,
            value: workspace.courseClass.name,
            hint: `${workspace.courseClass.semester.name} (${workspace.courseClass.semester.code})`,
          },
          {
            label: copy.hotelLabel,
            value: workspace.team.hotelName,
            hint: `${copy.classStatusHintPrefix} ${classStatusLabel}`,
          },
          {
            label: copy.processedRoundsLabel,
            value: String(resultsAscending.length),
            hint: `${copy.currentClassRoundPrefix} ${workspace.courseClass.currentRound} / ${workspace.courseClass.maxRounds}`,
          },
          {
            label: copy.latestRankLabel,
            value: latestResult ? `#${latestResult.rankOverall}` : "-",
            hint: `${copy.revenueRankPrefix} ${latestResult?.rankRevenue ?? "-"} | ${copy.profitRankPrefix} ${latestResult?.rankProfit ?? "-"}`,
          },
        ]}
        actions={[
          { href: "/student/dashboard", label: copy.actions.dashboard, variant: "default" },
          { href: "/student/decisions", label: copy.actions.decisions },
          { href: "/student/rankings", label: copy.actions.rankings },
        ]}
      />

      {resultsQuery.isLoading ? (
        <Card className="dashboard-card-surface">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {copy.loadingCard}
          </CardContent>
        </Card>
      ) : resultsQuery.error ? (
        <Card className="dashboard-card-alert">
          <CardContent className="p-6 text-sm text-destructive">
            {resultsQuery.error instanceof ApiClientError
              ? resultsQuery.error.message
              : copy.genericError}
          </CardContent>
        </Card>
      ) : resultsAscending.length === 0 ? (
        <Card className="dashboard-card-surface">
          <CardContent className="p-6 text-sm text-muted-foreground">
            {copy.noResultsYet}
          </CardContent>
        </Card>
      ) : latestResult ? (
        <>
          <Card className="dashboard-card-surface">
            <CardHeader>
              <CardTitle className="text-xl">{copy.latestOutcomeTitle}</CardTitle>
              <CardDescription>
                {copy.latestOutcomeDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="dashboard-panel">
                <p className="text-sm text-muted-foreground">{copy.revenueLabel}</p>
                <p className="mt-2 text-xl font-semibold">
                  {formatCompactCurrency(latestResult.totalRevenue)}
                </p>
              </div>
              <div className="dashboard-panel">
                <p className="text-sm text-muted-foreground">{copy.netProfitLabel}</p>
                <p className="mt-2 text-xl font-semibold">
                  {formatCompactCurrency(latestResult.netProfit)}
                </p>
              </div>
              <div className="dashboard-panel">
                <p className="text-sm text-muted-foreground">{copy.occupancyLabel}</p>
                <p className="mt-2 text-xl font-semibold">
                  {formatPercent(latestResult.occupancyRate)}
                </p>
              </div>
              <div className="dashboard-panel">
                <p className="text-sm text-muted-foreground">{copy.teacherScoreLabel}</p>
                <p className="mt-2 text-xl font-semibold">
                  {formatNumber(latestResult.teacherScore)}
                </p>
              </div>
            </CardContent>
          </Card>

          <ResultExplanationCards
            locale={locale === "zh-CN" ? "zh-CN" : "en-US"}
            latestResult={latestResult}
          />

          <section className="content-auto motion-fade-up motion-fade-delay-1 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <Card className="dashboard-card-surface">
              <CardHeader>
                <CardTitle className="text-xl">{copy.trendTitle}</CardTitle>
                <CardDescription>
                  {copy.trendDescription}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PerformanceHistoryChart
                  data={resultsAscending.map((result) => ({
                    roundNumber: result.roundNumber,
                    totalRevenue: result.totalRevenue,
                    netProfit: result.netProfit,
                    occupancyRate: result.occupancyRate,
                  }))}
                />
              </CardContent>
            </Card>

            <Card className="dashboard-card-surface">
              <CardHeader>
                <CardTitle className="text-xl">{copy.feedbackTitle}</CardTitle>
                <CardDescription>
                  {copy.feedbackDescription}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="dashboard-panel">
                  <p className="text-sm text-muted-foreground">{copy.teacherScoreLabel}</p>
                  <p className="mt-2 text-2xl font-semibold">
                    {formatNumber(latestResult.teacherScore)}
                  </p>
                </div>
                <div className="dashboard-panel">
                  <p className="text-sm text-muted-foreground">{copy.commentLabel}</p>
                  <p className="mt-2 text-sm leading-7 text-foreground">
                    {latestResult.teacherComment || copy.noTeacherComment}
                  </p>
                </div>
                <div className="dashboard-panel text-sm text-muted-foreground">
                  {copy.latestProcessedPrefix}: {formatRoundLabel(latestResult.roundNumber)}{" "}
                  {formatDate(latestResult.round.processedAt)}
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="content-auto motion-fade-up motion-fade-delay-2 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="dashboard-card-surface interactive-lift">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{copy.adrLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {formatCurrency(latestResult.adr)}
                </p>
              </CardContent>
            </Card>
            <Card className="dashboard-card-surface interactive-lift">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{copy.revparLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {formatCurrency(latestResult.revpar)}
                </p>
              </CardContent>
            </Card>
            <Card className="dashboard-card-surface interactive-lift">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{copy.cashBalanceLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {formatCompactCurrency(latestResult.cashBalanceEnd)}
                </p>
              </CardContent>
            </Card>
            <Card className="dashboard-card-surface interactive-lift">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{copy.marketShareLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {formatPercent(latestResult.overallMarketShare)}
                </p>
              </CardContent>
            </Card>
          </section>

          <Card className="content-auto motion-fade-up motion-fade-delay-3 dashboard-card-surface">
            <CardHeader>
              <CardTitle className="text-xl">{copy.historyTitle}</CardTitle>
              <CardDescription>
                {copy.historyDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {resultsAscending
                .slice()
                .reverse()
                .map((result) => (
                  <div
                    key={result.id}
                    className="dashboard-panel interactive-lift"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="font-medium text-foreground">
                          {formatRoundLabel(result.roundNumber)}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {copy.overallRankPrefix} #{result.rankOverall} | {copy.processedPrefix}{" "}
                          {formatDate(result.round.processedAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">
                          {copy.revenueLabel} {formatCompactCurrency(result.totalRevenue)}
                        </Badge>
                        <Badge variant="outline">
                          {copy.netProfitLabel} {formatCompactCurrency(result.netProfit)}
                        </Badge>
                        <Badge variant="outline">
                          {copy.occupancyLabel} {formatPercent(result.occupancyRate)}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="dashboard-panel-subtle">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          {copy.guestSatisfactionLabel}
                        </p>
                        <p className="mt-2 font-medium text-foreground">
                          {formatNumber(result.guestSatisfactionEnd)}
                        </p>
                      </div>
                      <div className="dashboard-panel-subtle">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          {copy.esgLabel}
                        </p>
                        <p className="mt-2 font-medium text-foreground">
                          {formatNumber(result.esgScoreEnd)}
                        </p>
                      </div>
                      <div className="dashboard-panel-subtle">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          {copy.cashLabel}
                        </p>
                        <p className="mt-2 font-medium text-foreground">
                          {formatCompactCurrency(result.cashBalanceEnd)}
                        </p>
                      </div>
                      <div className="dashboard-panel-subtle">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          {copy.debtLabel}
                        </p>
                        <p className="mt-2 font-medium text-foreground">
                          {formatCompactCurrency(result.totalDebtEnd)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 dashboard-panel-subtle">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {copy.teacherFeedbackLabel}
                      </p>
                      <p className="mt-2 text-sm text-foreground">
                        {copy.scorePrefix} {formatNumber(result.teacherScore)} |{" "}
                        {result.teacherComment || copy.noCommentYet}
                      </p>
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="dashboard-card-surface">
          <CardContent className="p-6 text-sm text-muted-foreground">
            {copy.unresolvedLatestSnapshot}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
