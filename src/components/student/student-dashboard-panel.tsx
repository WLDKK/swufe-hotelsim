"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ChartLoadingSkeleton } from "@/components/layout/chart-loading-skeleton";
import { StudentRoundEnvironmentCard } from "@/components/student/student-round-environment-card";
import { StudentWorkspaceHero } from "@/components/student/student-workspace-hero";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { type DecisionFormValues } from "@/lib/decisions/form";
import { useLocale } from "@/i18n/use-locale";
import {
  getDecisionStatusLabel,
  getRoundStatusLabel,
} from "@/i18n/status-labels";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/lib/formatters";

// Recharts is only needed once the student actually scrolls to chart-heavy
// sections, so load those modules lazily and show a shaped placeholder first.
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

const DemandSignalRadar = dynamic(
  () =>
    import("@/components/dashboard/demand-signal-radar").then(
      (module) => module.DemandSignalRadar
    ),
  {
    ssr: false,
    loading: () => <ChartLoadingSkeleton className="h-80" />,
  }
);

type StudentDashboardPanelProps = {
  workspace: {
    team: {
      id: string;
      name: string;
      hotelName: string;
      color: string;
      hotelState: {
        cashBalance: number;
        totalDebt: number;
        brandReputation: number;
        guestSatisfaction: number;
        esgScore: number;
      } | null;
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
    round: {
      id: string;
      roundNumber: number;
      status: string;
      seasonFactor: number;
      economyFactor: number;
      eventFactor: number;
      eventDescription: string | null;
      randomSeed: string | null;
      deadline: string | null;
      processedAt: string | null;
    } | null;
  };
};

type DecisionRecord = DecisionFormValues & {
  id: string;
  status: string;
  updatedAt: string;
  submittedAt: string | null;
};

type DecisionResponse = {
  decision: DecisionRecord | null;
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
  teacherScore: number | null;
  teacherComment: string | null;
  round: {
    id: string;
    roundNumber: number;
    status: string;
    processedAt: string | null;
  };
};

type TeamResultsResponse = {
  latestResult: TeamResultItem | null;
  results: TeamResultItem[];
};

type LeaderboardEntry = {
  teamId: string;
  rankOverall: number;
  rankRevenue: number;
  rankProfit: number;
  occupancyRate: number;
  adr: number;
  revpar: number;
  totalRevenue: number;
  netProfit: number;
  overallMarketShare: number;
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
};

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

export function StudentDashboardPanel({
  workspace,
}: StudentDashboardPanelProps) {
  const { locale, messages } = useLocale();
  const copy = messages.studentDashboard;
  const dashboardDescription =
    locale === "zh-CN"
      ? "这个页面把实时决策、结果与排名信息收束到同一视图里，帮助学生在进入下一轮前快速判断团队当前状态。"
      : "This page compresses live decision, results, and leaderboard data into one view so students can judge team status before the next round.";
  const quickActionsDescription =
    locale === "zh-CN"
      ? "这些入口帮助学生在总览、决策、结果与排名之间顺畅切换，保持同一条实验工作流不被打断。"
      : "These shortcuts help students move between dashboard, decisions, results, and rankings without losing context.";
  const formatRoundLabel = (roundNumber: number) =>
    locale === "zh-CN" ? `第 ${roundNumber} 轮` : `Round ${roundNumber}`;

  const decisionQuery = useQuery({
    queryKey: ["student-dashboard-decision", workspace.team.id, workspace.round?.id],
    queryFn: () =>
      apiFetch<DecisionResponse>(
        `/api/decisions?teamId=${workspace.team.id}&roundId=${workspace.round?.id}`
      ),
    enabled: Boolean(workspace.round?.id),
    refetchOnWindowFocus: false,
  });

  const resultsQuery = useQuery({
    queryKey: ["student-dashboard-results", workspace.team.id],
    queryFn: () =>
      apiFetch<TeamResultsResponse>(`/api/simulation/results?teamId=${workspace.team.id}`),
  });

  const rankingsQuery = useQuery({
    queryKey: ["student-dashboard-rankings", workspace.courseClass.id],
    queryFn: () =>
      apiFetch<ClassResultsResponse>(
        `/api/simulation/results?classId=${workspace.courseClass.id}`
      ),
  });

  const currentDecision = decisionQuery.data?.decision ?? null;
  const resultsAscending = useMemo(
    () =>
      [...(resultsQuery.data?.results ?? [])].sort(
        (left, right) => left.roundNumber - right.roundNumber
      ),
    [resultsQuery.data?.results]
  );
  const latestResult =
    resultsQuery.data?.latestResult ??
    resultsAscending[resultsAscending.length - 1] ??
    null;
  const ownLeaderboardEntry =
    rankingsQuery.data?.leaderboard.find(
      (entry) => entry.teamId === workspace.team.id
    ) ?? null;
  const leadingTeam = rankingsQuery.data?.leaderboard[0] ?? null;
  const radarMetricLabels = copy.radarMetrics as Record<string, string>;
  const roundStatusLabel = getRoundStatusLabel(locale, workspace.round?.status);
  const decisionStatusLabel = getDecisionStatusLabel(
    locale,
    currentDecision?.status ?? (workspace.round ? "NOT_STARTED" : null)
  );

  // The Stage 7 dashboard keeps this shape-based read of the latest
  // performance so students can compare mixed units quickly. Each signal is
  // normalized to 0-100 rather than pretending profit, ESG, and satisfaction
  // share the same scale.
  const radarSignals = useMemo(() => {
    if (!latestResult) {
      return [];
    }

    const normalizedProfitability =
      latestResult.totalRevenue > 0
        ? Math.max(
            0,
            Math.min(100, (latestResult.netProfit / latestResult.totalRevenue) * 250)
          )
        : 0;

    return [
      {
        metric: radarMetricLabels.occupancy,
        value: Math.max(0, Math.min(100, latestResult.occupancyRate * 100)),
      },
      {
        metric: radarMetricLabels.marketShare,
        value: Math.max(0, Math.min(100, latestResult.overallMarketShare * 250)),
      },
      {
        metric: radarMetricLabels.satisfaction,
        value: Math.max(0, Math.min(100, latestResult.guestSatisfactionEnd)),
      },
      {
        metric: radarMetricLabels.esg,
        value: Math.max(0, Math.min(100, latestResult.esgScoreEnd)),
      },
      {
        metric: radarMetricLabels.teacherScore,
        value: Math.max(0, Math.min(100, latestResult.teacherScore ?? 0)),
      },
      {
        metric: radarMetricLabels.profitability,
        value: normalizedProfitability,
      },
    ];
  }, [latestResult, radarMetricLabels]);

  const decisionSummary = useMemo(() => {
    if (!currentDecision) {
      return null;
    }

    const marketingAllocated = sum([
      currentDecision.mktBudgetBusinessTransient,
      currentDecision.mktBudgetBusinessGroup,
      currentDecision.mktBudgetLeisureTransient,
      currentDecision.mktBudgetLeisureGroup,
      currentDecision.mktBudgetGovernment,
      currentDecision.mktBudgetOnlineOTA,
      currentDecision.mktBudgetAirlineCrew,
      currentDecision.mktBudgetLongStay,
    ]);
    const channelMix = sum([
      currentDecision.channelDirect,
      currentDecision.channelOTA,
      currentDecision.channelTravelAgent,
      currentDecision.channelCorporate,
      currentDecision.channelGDS,
    ]);
    const totalOpex = sum([
      currentDecision.opexRoomsMaintenance,
      currentDecision.opexFoodBeverage,
      currentDecision.opexFrontDesk,
      currentDecision.opexHousekeeping,
      currentDecision.opexUtilities,
      currentDecision.opexStaffTraining,
      currentDecision.opexStaffWelfare,
      currentDecision.opexSecurity,
      currentDecision.opexIT,
    ]);
    const totalCapex = sum([
      currentDecision.capexRenovation,
      currentDecision.capexFurniture,
      currentDecision.capexTechnology,
      currentDecision.capexFacilities,
      currentDecision.capexESGGreen,
    ]);

    return {
      marketingAllocated,
      marketingGap: currentDecision.marketingTotal - marketingAllocated,
      channelMix,
      channelGap: 100 - channelMix,
      totalOpex,
      totalCapex,
      netFinancing: currentDecision.newLoanAmount - currentDecision.loanRepayment,
    };
  }, [currentDecision]);

  // Dashboard is a synthesized workspace: it merges the active decision round,
  // latest processed result, and latest class leaderboard so students can see
  // "what should we do now" and "how did we do last time" in one screen.
  const dashboardError =
    decisionQuery.error ?? resultsQuery.error ?? rankingsQuery.error ?? null;
  const isLoading =
    (workspace.round?.id ? decisionQuery.isLoading : false) ||
    resultsQuery.isLoading ||
    rankingsQuery.isLoading;
  const heroSummaryItems = [
    {
      label: copy.classLabel,
      value: workspace.courseClass.name,
      hint: `${workspace.courseClass.semester.name} (${workspace.courseClass.semester.code})`,
    },
    {
      label: copy.currentRoundLabel,
      value: workspace.round
        ? `${workspace.round.roundNumber} / ${workspace.courseClass.maxRounds}`
        : `0 / ${workspace.courseClass.maxRounds}`,
      hint: workspace.round
        ? `${roundStatusLabel} | ${copy.deadlineHintPrefix} ${formatDate(workspace.round.deadline)}`
        : copy.waitingTeacherInit,
    },
    {
      label: copy.decisionStatusLabel,
      value: decisionStatusLabel,
      hint: `${copy.updatedPrefix} ${formatDate(currentDecision?.updatedAt ?? null)}`,
    },
    {
      label: copy.latestClassRankLabel,
      value: ownLeaderboardEntry ? `#${ownLeaderboardEntry.rankOverall}` : "-",
      hint: `${copy.revenueRankPrefix} #${ownLeaderboardEntry?.rankRevenue ?? "-"} | ${copy.profitRankPrefix} #${ownLeaderboardEntry?.rankProfit ?? "-"}`,
    },
  ];
  const quickActionNotice =
    workspace.round?.status === "PENDING"
      ? copy.quickActionEditable
      : workspace.round
        ? `${copy.quickActionReviewPrefix} ${roundStatusLabel}, ${copy.quickActionReviewSuffix}`
        : copy.quickActionWaiting;

  return (
    <div className="flex flex-col gap-6">
      <StudentWorkspaceHero
        badgeLabel={copy.badgeLabel}
        title={`${copy.titlePrefix} ${workspace.team.name}`}
        description={dashboardDescription}
        statusTitle={copy.quickActionsTitle}
        statusBody={quickActionsDescription}
        summaryItems={heroSummaryItems}
        actions={[
          { href: "/student/decisions", label: copy.actions.decisions, variant: "default" },
          { href: "/student/results", label: copy.actions.results },
          { href: "/student/rankings", label: copy.actions.rankings },
        ]}
        statusFooter={
          <div className="rounded-2xl border border-amber-400/15 bg-amber-300/10 p-4 text-sm text-slate-200">
            {quickActionNotice}
          </div>
        }
      />

      <StudentRoundEnvironmentCard
        locale={locale === "zh-CN" ? "zh-CN" : "en-US"}
        round={workspace.round}
        hotelState={workspace.team.hotelState}
        values={currentDecision}
      />

      {isLoading ? (
        <Card className="dashboard-card-surface">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {copy.loadingCard}
          </CardContent>
        </Card>
      ) : dashboardError ? (
        <Card className="dashboard-card-alert">
          <CardContent className="p-6 text-sm text-destructive">
            {dashboardError instanceof ApiClientError
              ? dashboardError.message
              : copy.genericError}
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="content-auto motion-fade-up motion-fade-delay-1 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="dashboard-card-surface interactive-lift">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{copy.cashLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {formatCompactCurrency(workspace.team.hotelState?.cashBalance)}
                </p>
              </CardContent>
            </Card>
            <Card className="dashboard-card-surface interactive-lift">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{copy.debtLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {formatCompactCurrency(workspace.team.hotelState?.totalDebt)}
                </p>
              </CardContent>
            </Card>
            <Card className="dashboard-card-surface interactive-lift">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{copy.brandLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {formatNumber(workspace.team.hotelState?.brandReputation)}
                </p>
              </CardContent>
            </Card>
            <Card className="dashboard-card-surface interactive-lift">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{copy.guestSatisfactionLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {formatNumber(workspace.team.hotelState?.guestSatisfaction)}
                </p>
              </CardContent>
            </Card>
          </section>

          <section className="content-auto motion-fade-up motion-fade-delay-2 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <Card className="dashboard-card-surface">
              <CardHeader>
                <CardTitle className="text-xl">{copy.readinessTitle}</CardTitle>
                <CardDescription>
                  {copy.readinessDescription}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentDecision && decisionSummary ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="dashboard-panel">
                        <p className="text-sm text-muted-foreground">{copy.marketingAllocationLabel}</p>
                        <p className="mt-2 text-xl font-semibold">
                          {formatNumber(decisionSummary.marketingAllocated)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {copy.plannedLabel} {formatNumber(currentDecision.marketingTotal)} | {copy.gapLabel}{" "}
                          {formatNumber(decisionSummary.marketingGap)}
                        </p>
                      </div>
                      <div className="dashboard-panel">
                        <p className="text-sm text-muted-foreground">{copy.channelMixLabel}</p>
                        <p className="mt-2 text-xl font-semibold">
                          {formatNumber(decisionSummary.channelMix)}%
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {copy.remainingTo100Label} {formatNumber(decisionSummary.channelGap)}%
                        </p>
                      </div>
                      <div className="dashboard-panel">
                        <p className="text-sm text-muted-foreground">{copy.operatingSpendLabel}</p>
                        <p className="mt-2 text-xl font-semibold">
                          {formatNumber(decisionSummary.totalOpex)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {copy.currentDraftUpdatedPrefix} {formatDate(currentDecision.updatedAt)}
                        </p>
                      </div>
                      <div className="dashboard-panel">
                        <p className="text-sm text-muted-foreground">{copy.capexFinancingLabel}</p>
                        <p className="mt-2 text-xl font-semibold">
                          {formatNumber(decisionSummary.totalCapex)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {copy.loanDeltaLabel} {formatNumber(decisionSummary.netFinancing)}
                        </p>
                      </div>
                    </div>
                    <div className="dashboard-panel text-sm text-muted-foreground">
                      {currentDecision.status === "SUBMITTED"
                        ? `${copy.submittedNotePrefix} ${formatDate(
                            currentDecision.submittedAt
                          )} ${copy.submittedNoteSuffix}`
                        : copy.draftOnlyNote}
                    </div>
                  </>
                ) : (
                  <div className="dashboard-panel-dashed">
                    {workspace.round
                      ? copy.noDraftYet
                      : copy.noActiveRoundDecisionSummary}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="dashboard-card-surface">
              <CardHeader>
                <CardTitle className="text-xl">{copy.latestOutcomeTitle}</CardTitle>
                <CardDescription>
                  {copy.latestOutcomeDescription}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {latestResult ? (
                  <>
                    <div className="dashboard-panel">
                      <p className="text-sm text-muted-foreground">{copy.completedRoundLabel}</p>
                      <p className="mt-2 text-xl font-semibold">
                        {formatRoundLabel(latestResult.roundNumber)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {copy.processedPrefix} {formatDate(latestResult.round.processedAt)}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="dashboard-panel">
                        <p className="text-sm text-muted-foreground">{copy.revenueLabel}</p>
                        <p className="mt-2 text-xl font-semibold">
                          {formatCompactCurrency(latestResult.totalRevenue)}
                        </p>
                      </div>
                      <div className="dashboard-panel">
                        <p className="text-sm text-muted-foreground">{copy.profitLabel}</p>
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
                    </div>
                    <div className="dashboard-panel text-sm text-muted-foreground">
                      {latestResult.teacherComment || copy.noTeacherComment}
                    </div>
                  </>
                ) : (
                  <div className="dashboard-panel-dashed">
                    {copy.noProcessedResult}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="content-auto motion-fade-up motion-fade-delay-3 grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="grid gap-4">
              <Card className="dashboard-card-surface">
                <CardHeader>
                  <CardTitle className="text-xl">{copy.trendTitle}</CardTitle>
                  <CardDescription>
                    {copy.trendDescription}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {resultsAscending.length > 0 ? (
                    <PerformanceHistoryChart
                      data={resultsAscending.map((result) => ({
                        roundNumber: result.roundNumber,
                        totalRevenue: result.totalRevenue,
                        netProfit: result.netProfit,
                        occupancyRate: result.occupancyRate,
                      }))}
                    />
                  ) : (
                    <div className="dashboard-panel-dashed">
                      {copy.trendEmpty}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="dashboard-card-surface">
                <CardHeader>
                  <CardTitle className="text-xl">{copy.radarTitle}</CardTitle>
                  <CardDescription>
                    {copy.radarDescription}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {radarSignals.length > 0 ? (
                    <>
                      <DemandSignalRadar data={radarSignals} />
                      <div className="dashboard-panel text-sm text-muted-foreground">
                        {copy.radarNormalizedNote}
                      </div>
                    </>
                  ) : (
                    <div className="dashboard-panel-dashed">
                      {copy.radarEmpty}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="dashboard-card-surface">
              <CardHeader>
                <CardTitle className="text-xl">{copy.classPositionTitle}</CardTitle>
                <CardDescription>
                  {copy.classPositionDescription}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {rankingsQuery.data?.roundNumber && ownLeaderboardEntry ? (
                  <>
                    <div className="dashboard-panel">
                      <p className="text-sm text-muted-foreground">{copy.leaderboardRoundLabel}</p>
                      <p className="mt-2 text-xl font-semibold">
                        {formatRoundLabel(rankingsQuery.data.roundNumber)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {rankingsQuery.data.availableRoundNumbers.length} {copy.completedRoundsAvailableSuffix}
                      </p>
                    </div>
                    <div className="dashboard-panel">
                      <p className="text-sm text-muted-foreground">{copy.yourStandingLabel}</p>
                      <p className="mt-2 text-2xl font-semibold">
                        #{ownLeaderboardEntry.rankOverall}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {copy.revenueRankPrefix} #{ownLeaderboardEntry.rankRevenue} | {copy.profitRankPrefix} #
                        {ownLeaderboardEntry.rankProfit}
                      </p>
                    </div>
                    <div className="dashboard-panel">
                      <p className="text-sm text-muted-foreground">{copy.topTeamLabel}</p>
                      <p className="mt-2 text-lg font-semibold">
                        {leadingTeam ? `#${leadingTeam.rankOverall} ${leadingTeam.team.name}` : "-"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {copy.revenueLabel} {formatCompactCurrency(leadingTeam?.totalRevenue)}
                      </p>
                    </div>
                    <div className="dashboard-panel">
                      <p className="text-sm text-muted-foreground">{copy.yourLatestMetricsLabel}</p>
                      <p className="mt-2 text-sm text-foreground">
                        {copy.revenueLabel} {formatCurrency(ownLeaderboardEntry.totalRevenue)} | {copy.profitLabel}{" "}
                        {formatCurrency(ownLeaderboardEntry.netProfit)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {copy.occupancyLabel} {formatPercent(ownLeaderboardEntry.occupancyRate)} | {radarMetricLabels.marketShare}{" "}
                        {formatPercent(ownLeaderboardEntry.overallMarketShare)}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="dashboard-panel-dashed">
                    {copy.noLeaderboardYet}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
