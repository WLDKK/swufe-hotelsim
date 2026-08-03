"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ChartLoadingSkeleton } from "@/components/layout/chart-loading-skeleton";
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
  formatPercent,
} from "@/lib/formatters";
import { useLocale } from "@/i18n/use-locale";

const LeaderboardChart = dynamic(
  () =>
    import("@/components/results/leaderboard-chart").then(
      (module) => module.LeaderboardChart
    ),
  {
    ssr: false,
    loading: () => <ChartLoadingSkeleton className="h-80" />,
  }
);

type StudentRankingsPanelProps = {
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
      semester: {
        id: string;
        name: string;
        code: string;
      };
    };
  };
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

type ResultRow = {
  id: string;
  teamId: string;
  roundNumber: number;
  teacherScore: number | null;
  teacherComment: string | null;
};

type ClassResultsResponse = {
  roundNumber: number | null;
  availableRoundNumbers: number[];
  leaderboard: LeaderboardEntry[];
  results: ResultRow[];
};

const selectClassName = "dashboard-select";

export function StudentRankingsPanel({
  workspace,
}: StudentRankingsPanelProps) {
  const { locale, messages } = useLocale();
  const copy = messages.studentRankings;
  const rankingsDescription =
    locale === "zh-CN"
      ? "这个页面读取实时班级排行榜，让团队能够和同班其他队伍进行直观对比。"
      : "This page reads the live class leaderboard so teams can compare their position against the rest of the cohort.";
  const formatRoundLabel = (roundNumber: number) =>
    locale === "zh-CN" ? `第 ${roundNumber} 轮` : `Round ${roundNumber}`;
  const [selectedRoundNumber, setSelectedRoundNumber] = useState<number | null>(null);

  const rankingsQuery = useQuery({
    queryKey: ["student-class-rankings", workspace.courseClass.id, selectedRoundNumber],
    queryFn: () =>
      apiFetch<ClassResultsResponse>(
        selectedRoundNumber
          ? `/api/simulation/results?classId=${workspace.courseClass.id}&roundNumber=${selectedRoundNumber}`
          : `/api/simulation/results?classId=${workspace.courseClass.id}`
      ),
    // Preserve the previous round snapshot during selector changes so the
    // leaderboard panel feels continuous instead of flashing empty state.
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    const availableRounds = rankingsQuery.data?.availableRoundNumbers ?? [];
    if (availableRounds.length === 0) {
      return;
    }

    // Only completed rounds are exposed by the API. If the selected round is
    // missing or becomes stale after a refetch, snap the selector back to the
    // latest available completed round so the page never points at empty data.
    if (!selectedRoundNumber || !availableRounds.includes(selectedRoundNumber)) {
      setSelectedRoundNumber(availableRounds[0]);
    }
  }, [rankingsQuery.data?.availableRoundNumbers, selectedRoundNumber]);

  const ownEntry = useMemo(
    () =>
      (rankingsQuery.data?.leaderboard ?? []).find(
        (entry) => entry.teamId === workspace.team.id
      ) ?? null,
    [rankingsQuery.data?.leaderboard, workspace.team.id]
  );

  const leadingEntry = rankingsQuery.data?.leaderboard?.[0] ?? null;
  const averageOccupancy =
    rankingsQuery.data?.leaderboard.length
      ? rankingsQuery.data.leaderboard.reduce(
          (sum, entry) => sum + entry.occupancyRate,
          0
        ) / rankingsQuery.data.leaderboard.length
      : null;

  return (
    <div className="flex flex-col gap-6">
      <StudentWorkspaceHero
        badgeLabel={copy.badgeLabel}
        title={`${copy.titlePrefix} ${workspace.courseClass.name}`}
        description={rankingsDescription}
        statusTitle={copy.statusTitle}
        statusBody={
          rankingsQuery.data?.roundNumber
            ? `${formatRoundLabel(rankingsQuery.data.roundNumber)} ${copy.selectedRoundMiddle}`
            : copy.emptyStatus
        }
        summaryItems={[
          {
            label: copy.classLabel,
            value: workspace.courseClass.name,
            hint: `${workspace.courseClass.semester.name} (${workspace.courseClass.semester.code})`,
          },
          {
            label: copy.yourTeamLabel,
            value: workspace.team.name,
            hint: workspace.team.hotelName,
          },
          {
            label: copy.selectedRoundLabel,
            value: rankingsQuery.data?.roundNumber
              ? formatRoundLabel(rankingsQuery.data.roundNumber)
              : "-",
            hint: `${copy.completedRoundsLabel} ${(rankingsQuery.data?.availableRoundNumbers ?? []).length}`,
          },
          {
            label: copy.yourOverallRankLabel,
            value: ownEntry ? `#${ownEntry.rankOverall}` : "-",
            hint: `${copy.revenueRankPrefix} #${ownEntry?.rankRevenue ?? "-"} | ${copy.profitRankPrefix} #${ownEntry?.rankProfit ?? "-"}`,
          },
        ]}
        actions={[
          { href: "/student/dashboard", label: copy.actions.dashboard, variant: "default" },
          { href: "/student/decisions", label: copy.actions.decisions },
          { href: "/student/results", label: copy.actions.results },
        ]}
      />

      <Card className="dashboard-card-surface">
        <CardHeader>
          <CardTitle className="text-xl">{copy.roundSelectorTitle}</CardTitle>
          <CardDescription>
            {copy.roundSelectorDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label htmlFor="student-ranking-round" className="text-sm font-medium">
            {copy.completedRoundLabel}
          </label>
          <select
            id="student-ranking-round"
            className={selectClassName}
            value={selectedRoundNumber ?? ""}
            onChange={(event) => {
              const nextValue = Number(event.target.value);
              setSelectedRoundNumber(Number.isFinite(nextValue) ? nextValue : null);
            }}
          >
            {(rankingsQuery.data?.availableRoundNumbers ?? []).map((roundNumber) => (
              <option key={roundNumber} value={roundNumber}>
                {formatRoundLabel(roundNumber)}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {rankingsQuery.isLoading ? (
        <Card className="dashboard-card-surface">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {copy.loadingCard}
          </CardContent>
        </Card>
      ) : rankingsQuery.error ? (
        <Card className="dashboard-card-alert">
          <CardContent className="p-6 text-sm text-destructive">
            {rankingsQuery.error instanceof ApiClientError
              ? rankingsQuery.error.message
              : copy.genericError}
          </CardContent>
        </Card>
      ) : !rankingsQuery.data?.roundNumber || rankingsQuery.data.leaderboard.length === 0 ? (
        <Card className="dashboard-card-surface">
          <CardContent className="p-6 text-sm text-muted-foreground">
            {copy.noLeaderboardYet}
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="content-auto motion-fade-up motion-fade-delay-1 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="dashboard-card-surface interactive-lift">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{copy.leaderTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold">
                  {leadingEntry ? `#${leadingEntry.rankOverall} ${leadingEntry.team.name}` : "-"}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {copy.revenueLabel} {formatCompactCurrency(leadingEntry?.totalRevenue)}
                </p>
              </CardContent>
            </Card>
            <Card className="dashboard-card-surface interactive-lift">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{copy.averageOccupancyTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold">
                  {formatPercent(averageOccupancy)}
                </p>
              </CardContent>
            </Card>
            <Card className="dashboard-card-surface interactive-lift">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{copy.yourMarketShareTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold">
                  {formatPercent(ownEntry?.overallMarketShare)}
                </p>
              </CardContent>
            </Card>
            <Card className="dashboard-card-surface interactive-lift">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{copy.yourRevenueTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold">
                  {formatCompactCurrency(ownEntry?.totalRevenue)}
                </p>
              </CardContent>
            </Card>
          </section>

          <section className="content-auto motion-fade-up motion-fade-delay-2 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <Card className="dashboard-card-surface">
              <CardHeader>
                <CardTitle className="text-xl">{copy.revenueLeaderboardTitle}</CardTitle>
                <CardDescription>
                  {copy.revenueLeaderboardDescription}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LeaderboardChart
                  data={rankingsQuery.data.leaderboard.map((entry) => ({
                    teamName: entry.team.name,
                    totalRevenue: entry.totalRevenue,
                  }))}
                />
              </CardContent>
            </Card>

            <Card className="dashboard-card-surface">
              <CardHeader>
                <CardTitle className="text-xl">{copy.detailsTitle}</CardTitle>
                <CardDescription>
                  {copy.detailsDescription}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {rankingsQuery.data.leaderboard.map((entry) => {
                  const isOwnTeam = entry.teamId === workspace.team.id;

                  return (
                    <div
                      key={entry.teamId}
                      className={`rounded-2xl border p-4 ${
                        isOwnTeam
                          ? "border-sky-400/30 bg-sky-400/10 shadow-[0_20px_50px_-32px_rgba(14,165,233,0.55)]"
                          : "border-white/10 bg-white/[0.04]"
                      }`}
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
                        {isOwnTeam ? (
                          <Badge>{copy.yourTeamBadge}</Badge>
                        ) : (
                          <Badge variant="outline">{copy.peerBadge}</Badge>
                        )}
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                        <span>
                          {copy.revenueLabel} {formatCurrency(entry.totalRevenue)} | {copy.profitLabel}{" "}
                          {formatCurrency(entry.netProfit)}
                        </span>
                        <span>
                          {copy.occupancyLabel} {formatPercent(entry.occupancyRate)} | {copy.adrLabel}{" "}
                          {formatCurrency(entry.adr)} | {copy.revparLabel} {formatCurrency(entry.revpar)}
                        </span>
                        <span>
                          {copy.revenueRankPrefix} #{entry.rankRevenue} | {copy.profitRankPrefix} #{entry.rankProfit} |
                          {" "}{copy.marketShareLabel} {formatPercent(entry.overallMarketShare)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
