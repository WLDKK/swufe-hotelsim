"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Download,
  Info,
  Loader2,
  PlayCircle,
  RefreshCw,
  Rocket,
  Save,
  Shuffle,
} from "lucide-react";
import { ChartLoadingSkeleton } from "@/components/layout/chart-loading-skeleton";
import { TeacherWorkspaceHero } from "@/components/teacher/teacher-workspace-hero";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/lib/formatters";
import {
  ENVIRONMENT_FACTOR_HINTS,
  ENVIRONMENT_PRESET_OPTIONS,
  buildRandomRoundEnvironment,
  buildRecommendedRoundEnvironment,
  describeRoundEnvironment,
  type EnvironmentEconomyId,
  type EnvironmentEventId,
  type EnvironmentWeatherId,
} from "@/lib/simulation/environment";
import { getProcessReadiness } from "@/lib/simulation/process-readiness";
import { useLocale } from "@/i18n/use-locale";
import {
  getClassStatusLabel,
  getDecisionStatusLabel,
  getRoundStatusLabel,
} from "@/i18n/status-labels";
import { cn } from "@/lib/utils";

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

type TeacherSimulationPanelProps = {
  initialClassId?: string;
};

type ClassesResponse = {
  classes: Array<{
    id: string;
    name: string;
    status: string;
    currentRound: number;
    maxRounds: number;
    semester: { id: string; name: string; code: string };
  }>;
};

type ClassDetailResponse = {
  class: {
    id: string;
    name: string;
    joinCode: string;
    status: string;
    currentRound: number;
    maxRounds: number;
    totalRooms: number;
    maxTeams: number;
    teams: Array<{
      id: string;
      name: string;
      hotelName: string;
      hotelState: { cashBalance: number; totalDebt: number } | null;
    }>;
    semester: { id: string; name: string; code: string };
  };
};

type RoundRecord = {
  id: string;
  roundNumber: number;
  status: string;
  deadline: string | null;
  processedAt: string | null;
  seasonFactor: number;
  economyFactor: number;
  eventFactor: number;
  eventDescription: string | null;
  randomSeed: string | null;
};

type RoundsResponse = {
  classId: string;
  currentRoundNumber: number;
  currentRound: RoundRecord | null;
  rounds: RoundRecord[];
};

type DecisionListResponse = {
  decisions: Array<{
    id: string;
    status: string;
    updatedAt: string;
    team: { id: string; name: string; hotelName: string };
  }>;
};

type ClassResultsResponse = {
  roundNumber: number | null;
  availableRoundNumbers: number[];
  leaderboard: Array<{
    teamId: string;
    rankOverall: number;
    totalRevenue: number;
    netProfit: number;
    overallMarketShare: number;
    occupancyRate: number;
    adr: number;
    team: { id: string; name: string; hotelName: string; color: string };
  }>;
  results: Array<{
    id: string;
    teamId: string;
    guestSatisfactionEnd: number;
    esgScoreEnd: number;
    cashBalanceEnd: number;
  }>;
};

type EnvironmentDraftState = {
  seasonFactor: string;
  economyFactor: string;
  eventFactor: string;
  eventDescription: string;
  randomSeed: string;
  weatherId: EnvironmentWeatherId;
  economyId: EnvironmentEconomyId;
  eventId: EnvironmentEventId;
};

const selectClassName = "dashboard-select";
const formFieldClassName =
  "mt-2 flex h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70";

function formatFactorInput(value: number) {
  return `${Math.round(value * 1000) / 1000}`;
}

function normalizeFactorInput(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 1000) / 1000 : fallback;
}

function buildDraftFromEnvironment(environment: {
  seasonFactor: number;
  economyFactor: number;
  eventFactor: number;
  eventDescription: string;
  randomSeed: string | null;
  weatherId: EnvironmentWeatherId | null;
  economyId: EnvironmentEconomyId | null;
  eventId: EnvironmentEventId | null;
}): EnvironmentDraftState {
  return {
    seasonFactor: formatFactorInput(environment.seasonFactor),
    economyFactor: formatFactorInput(environment.economyFactor),
    eventFactor: formatFactorInput(environment.eventFactor),
    eventDescription: environment.eventDescription,
    randomSeed: environment.randomSeed ?? "",
    weatherId: environment.weatherId ?? "stable_clear",
    economyId: environment.economyId ?? "steady",
    eventId: environment.eventId ?? "none",
  };
}

export function TeacherSimulationPanel({
  initialClassId,
}: TeacherSimulationPanelProps) {
  const { locale } = useLocale();
  const zh = locale === "zh-CN";
  const t = (zhText: string, enText: string) => (zh ? zhText : enText);
  const queryClient = useQueryClient();
  const [selectedClassId, setSelectedClassId] = useState(initialClassId ?? "");
  const [environmentDraft, setEnvironmentDraft] =
    useState<EnvironmentDraftState | null>(null);

  const classesQuery = useQuery({
    queryKey: ["teacher-simulation-classes"],
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

    if (!selectedClassId && classes.length > 0) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, initialClassId, selectedClassId]);

  const classDetailQuery = useQuery({
    queryKey: ["teacher-simulation-class", selectedClassId],
    queryFn: () =>
      apiFetch<ClassDetailResponse>(`/api/classes?classId=${selectedClassId}`),
    enabled: Boolean(selectedClassId),
    placeholderData: keepPreviousData,
  });

  const roundsQuery = useQuery({
    queryKey: ["teacher-simulation-rounds", selectedClassId],
    queryFn: () =>
      apiFetch<RoundsResponse>(`/api/rounds?classId=${selectedClassId}`),
    enabled: Boolean(selectedClassId),
    placeholderData: keepPreviousData,
  });

  const resultsQuery = useQuery({
    queryKey: ["teacher-simulation-results", selectedClassId],
    queryFn: () =>
      apiFetch<ClassResultsResponse>(
        `/api/simulation/results?classId=${selectedClassId}`
      ),
    enabled: Boolean(selectedClassId),
    placeholderData: keepPreviousData,
  });

  const classRecord = classDetailQuery.data?.class;
  const activeRound = roundsQuery.data?.currentRound ?? null;
  const timelineRounds = roundsQuery.data?.rounds ?? [];
  const targetRoundNumber =
    activeRound?.roundNumber ??
    (classRecord?.currentRound && classRecord.currentRound > 0
      ? classRecord.currentRound
      : 1);

  const decisionsQuery = useQuery({
    queryKey: ["teacher-simulation-decisions", selectedClassId, activeRound?.id],
    queryFn: () =>
      apiFetch<DecisionListResponse>(`/api/decisions?roundId=${activeRound?.id}`),
    enabled: Boolean(activeRound?.id),
  });

  const storedEnvironment = useMemo(() => {
    if (activeRound) {
      return describeRoundEnvironment({
        roundNumber: activeRound.roundNumber,
        seasonFactor: activeRound.seasonFactor,
        economyFactor: activeRound.economyFactor,
        eventFactor: activeRound.eventFactor,
        eventDescription: activeRound.eventDescription,
        randomSeed: activeRound.randomSeed,
      });
    }

    return buildRecommendedRoundEnvironment({ roundNumber: targetRoundNumber });
  }, [activeRound, targetRoundNumber]);

  useEffect(() => {
    setEnvironmentDraft(buildDraftFromEnvironment(storedEnvironment));
  }, [selectedClassId, storedEnvironment]);

  const draftPayload = useMemo(() => {
    const seasonFactor = normalizeFactorInput(
      environmentDraft?.seasonFactor ?? "",
      storedEnvironment.seasonFactor
    );
    const economyFactor = normalizeFactorInput(
      environmentDraft?.economyFactor ?? "",
      storedEnvironment.economyFactor
    );
    const eventFactor = normalizeFactorInput(
      environmentDraft?.eventFactor ?? "",
      storedEnvironment.eventFactor
    );
    const eventDescription =
      environmentDraft?.eventDescription.trim() || storedEnvironment.eventDescription;
    const randomSeed = environmentDraft?.randomSeed.trim() || null;

    return {
      seasonFactor,
      economyFactor,
      eventFactor,
      eventDescription,
      randomSeed,
    };
  }, [
    environmentDraft?.economyFactor,
    environmentDraft?.eventDescription,
    environmentDraft?.eventFactor,
    environmentDraft?.randomSeed,
    environmentDraft?.seasonFactor,
    storedEnvironment.economyFactor,
    storedEnvironment.eventDescription,
    storedEnvironment.eventFactor,
    storedEnvironment.seasonFactor,
  ]);

  const draftEnvironment = useMemo(
    () =>
      describeRoundEnvironment({
        roundNumber: targetRoundNumber,
        ...draftPayload,
      }),
    [draftPayload, targetRoundNumber]
  );

  const persistedPayload = useMemo(
    () =>
      activeRound
        ? {
            seasonFactor: Math.round(activeRound.seasonFactor * 1000) / 1000,
            economyFactor: Math.round(activeRound.economyFactor * 1000) / 1000,
            eventFactor: Math.round(activeRound.eventFactor * 1000) / 1000,
            eventDescription: activeRound.eventDescription ?? "",
            randomSeed: activeRound.randomSeed ?? null,
          }
        : null,
    [activeRound]
  );

  const hasUnsavedEnvironmentChanges = Boolean(
    activeRound &&
      persistedPayload &&
      JSON.stringify(persistedPayload) !== JSON.stringify(draftPayload)
  );

  const simulationMutation = useMutation({
    mutationFn: (action: "initialize" | "process") =>
      apiFetch("/api/simulation/run", {
        method: "POST",
        body: JSON.stringify({
          classId: selectedClassId,
          action,
          ...(action === "initialize" ? draftPayload : {}),
        }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["teacher-simulation-classes"] }),
        queryClient.invalidateQueries({
          queryKey: ["teacher-simulation-class", selectedClassId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["teacher-simulation-rounds", selectedClassId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["teacher-simulation-results", selectedClassId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["teacher-simulation-decisions", selectedClassId],
        }),
      ]);
    },
  });

  const environmentMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/rounds", {
        method: "PATCH",
        body: JSON.stringify({
          roundId: activeRound?.id,
          ...draftPayload,
        }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["teacher-simulation-rounds", selectedClassId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["teacher-simulation-class", selectedClassId],
        }),
      ]);
    },
  });

  const processReadiness = useMemo(
    () =>
      getProcessReadiness({
        currentRoundStatus: activeRound?.status,
        teamCount: classRecord?.teams.length ?? 0,
        decisionStatuses: (decisionsQuery.data?.decisions ?? []).map(
          (decision) => decision.status
        ),
      }),
    [activeRound?.status, classRecord?.teams.length, decisionsQuery.data?.decisions]
  );

  const classStatusLabel = getClassStatusLabel(locale, classRecord?.status);
  const canSaveEnvironment = Boolean(
    activeRound && activeRound.status === "PENDING" && selectedClassId
  );
  const processBlocked =
    simulationMutation.isPending ||
    !activeRound ||
    !processReadiness.canProcess ||
    hasUnsavedEnvironmentChanges;
  const selectedWeatherOption = ENVIRONMENT_PRESET_OPTIONS.weather.find(
    (option) => option.id === environmentDraft?.weatherId
  );
  const selectedEconomyOption = ENVIRONMENT_PRESET_OPTIONS.economy.find(
    (option) => option.id === environmentDraft?.economyId
  );
  const selectedEventOption = ENVIRONMENT_PRESET_OPTIONS.event.find(
    (option) => option.id === environmentDraft?.eventId
  );

  const applyRecommendedEnvironment = () => {
    if (!environmentDraft) {
      return;
    }

    const recommendation = buildRecommendedRoundEnvironment({
      roundNumber: targetRoundNumber,
      weatherId: environmentDraft.weatherId,
      economyId: environmentDraft.economyId,
      eventId: environmentDraft.eventId,
      randomSeed:
        environmentDraft.randomSeed.trim() || activeRound?.randomSeed || null,
    });

    setEnvironmentDraft(buildDraftFromEnvironment(recommendation));
  };

  const applyRandomEnvironment = () => {
    const recommendation = buildRandomRoundEnvironment({
      roundNumber: targetRoundNumber,
      classId: selectedClassId || null,
    });

    setEnvironmentDraft(buildDraftFromEnvironment(recommendation));
  };

  const resetEnvironmentDraft = () => {
    setEnvironmentDraft(buildDraftFromEnvironment(storedEnvironment));
  };

  const formatRoundLabel = (roundNumber: number) =>
    zh ? `第 ${roundNumber} 轮` : `Round ${roundNumber}`;

  const renderEnvironmentOutlook = () => {
    const label =
      draftEnvironment.demandOutlook === "strong"
        ? t("需求偏强", "Demand up")
        : draftEnvironment.demandOutlook === "soft"
          ? t("需求偏弱", "Demand down")
          : t("需求平衡", "Balanced");
    const className =
      draftEnvironment.demandOutlook === "strong"
        ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
        : draftEnvironment.demandOutlook === "soft"
          ? "border-rose-400/40 bg-rose-500/10 text-rose-100"
          : "border-sky-400/40 bg-sky-500/10 text-sky-100";

    return (
      <Badge variant="outline" className={className}>
        {label}
      </Badge>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <TeacherWorkspaceHero
        badgeLabel={t("教师 / 模拟控制台", "Teacher / Simulation")}
        title={t("酒店经营模拟调度中心", "Hotel simulation control center")}
        description={t(
          "在一个界面里完成轮次初始化、环境拟合、处理推进、结果查看与导出，方便教师连续推进实验或比赛流程。",
          "Run round initialization, environment fitting, processing, review, and export from one teacher-facing workspace."
        )}
        statusTitle={t("当前处理状态", "Current processing state")}
        statusBody={
          classRecord
            ? activeRound?.status === "PENDING"
              ? t(
                  `当前班级处于第 ${classRecord.currentRound} 轮待处理状态。建议先确认环境设定与学生提交，再执行处理。`,
                  `The selected class is waiting on round ${classRecord.currentRound}. Review the environment and submissions before processing.`
                )
              : t(
                  `当前班级状态为 ${classStatusLabel}。请根据轮次完成情况决定是否初始化下一轮或复盘既有结果。`,
                  `The selected class is currently ${classStatusLabel}. Initialize or review results based on its round lifecycle.`
                )
            : t(
                "先选择一个班级，系统才会展示该班的轮次、环境参数和提交进度。",
                "Choose a class to unlock round timeline, environment fitting, and submission tracking."
              )
        }
        summaryItems={[
          {
            label: t("当前轮次", "Current round"),
            value: classRecord ? `${classRecord.currentRound} / ${classRecord.maxRounds}` : "-",
            hint: classRecord
              ? t(`班级状态：${classStatusLabel}`, `Class status: ${classStatusLabel}`)
              : t("尚未选择班级。", "No class selected yet."),
          },
          {
            label: t("已提交团队", "Submitted teams"),
            value: classRecord
              ? `${processReadiness.submittedCount} / ${classRecord.teams.length}`
              : "-",
            hint: t(
              "只有提交状态为 SUBMITTED 的决策才允许进入处理。",
              "Only submitted decisions unlock processing."
            ),
          },
          {
            label: t("最近结果", "Latest results"),
            value: resultsQuery.data?.roundNumber
              ? formatRoundLabel(resultsQuery.data.roundNumber)
              : "-",
            hint: t(
              "这里显示最近一次可用于复盘和导出的结果轮次。",
              "Most recent processed round available for review and export."
            ),
          },
          {
            label: t("团队总数", "Teams"),
            value: classRecord ? String(classRecord.teams.length) : "-",
            hint: t(
              "当前班级下已创建的酒店团队数量。",
              "Teams currently attached to the selected class."
            ),
          },
        ]}
        actions={[
          {
            href: "/teacher/dashboard",
            label: t("打开教师总览", "Open dashboard"),
            variant: "default",
          },
          { href: "/teacher/classes", label: t("打开班级管理", "Open classes") },
          { href: "/teacher/grading", label: t("打开评分中心", "Open grading") },
        ]}
      />

      <Card className="dashboard-card-surface">
        <CardHeader>
          <CardTitle className="text-xl">{t("模拟控制", "Simulation controls")}</CardTitle>
          <CardDescription>
            {t(
              "先选班级，再决定是用当前环境初始化第 1 轮，还是在所有团队提交后处理当前轮次。",
              "Select a class, initialize round 1 with the current environment, or process the active round once all teams have submitted."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm">
            <label htmlFor="teacher-simulation-class" className="text-sm font-medium">
              {t("当前班级", "Selected class")}
            </label>
            <select
              id="teacher-simulation-class"
              className={selectClassName}
              value={selectedClassId}
              onChange={(event) => {
                setSelectedClassId(event.target.value);
              }}
            >
              {classes.map((courseClass) => (
                <option key={courseClass.id} value={courseClass.id}>
                  {courseClass.name} ({courseClass.semester.code})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            {classRecord?.currentRound && classRecord.currentRound > 0 ? (
              <Button
                className="gap-2"
                onClick={() => {
                  simulationMutation.mutate("process");
                }}
                disabled={processBlocked}
              >
                {simulationMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <PlayCircle className="size-4" />
                )}
                {t("处理当前轮次", "Process current round")}
              </Button>
            ) : (
              <Button
                className="gap-2"
                onClick={() => {
                  simulationMutation.mutate("initialize");
                }}
                disabled={simulationMutation.isPending || !selectedClassId}
              >
                {simulationMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Rocket className="size-4" />
                )}
                {t("以当前环境初始化第 1 轮", "Initialize round 1 with this environment")}
              </Button>
            )}
            {classRecord ? (
              <Link
                href={`/teacher/classes/${classRecord.id}`}
                className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
              >
                {t("打开班级详情", "Open class detail")}
              </Link>
            ) : null}
            {resultsQuery.data?.roundNumber ? (
              <a
                href={`/api/export?classId=${selectedClassId}&scope=results&format=csv&roundNumber=${resultsQuery.data.roundNumber}`}
                className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
              >
                <Download className="size-4" />
                {t("导出最近结果 CSV", "Export latest CSV")}
              </a>
            ) : null}
          </div>
          {hasUnsavedEnvironmentChanges ? (
            <p className="text-sm text-amber-200">
              {t(
                "你已修改环境拟合但尚未保存。请先保存环境参数，再处理当前轮次，避免误用旧配置。",
                "You changed the environment fit but have not saved it yet. Save it before processing."
              )}
            </p>
          ) : classRecord?.currentRound && classRecord.currentRound > 0 && !processReadiness.canProcess ? (
            <p className="text-sm text-muted-foreground">
              {t(
                "只有当每个团队在当前轮次都至少提交了一份 SUBMITTED 状态的决策后，才允许执行处理。",
                "Processing unlocks only after every team has one SUBMITTED decision for the active round."
              )}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="dashboard-card-surface">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl">
                {t("真实环境拟合", "Real-world environment fitting")}
              </CardTitle>
              <CardDescription>
                {t(
                  "系统会把季节性、景气度和短期事件映射到 `seasonFactor × economyFactor × eventFactor`，直接影响本轮市场需求强弱。",
                  "Seasonality, economy, weather, and city events are normalized into `seasonFactor × economyFactor × eventFactor`, which drives market demand."
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="size-4" />
              <span>
                {t("目标轮次", "Target round")}: {formatRoundLabel(targetRoundNumber)} ·{" "}
                {t("月份映射", "Month mapping")}: {draftEnvironment.monthLabel}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-4">
            <div className="dashboard-panel-subtle">
              <p className="text-sm font-medium text-foreground">
                {t("场景选择", "Scenario presets")}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t(
                  "先选天气、景气和事件，再生成建议值；如果需要压力测试，也可以直接随机生成。",
                  "Choose weather, economy, and event assumptions to generate a recommended setup, or create a random scenario for practice."
                )}
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div>
                  <label htmlFor="environment-weather" className="text-sm font-medium">
                    {t("天气场景", "Weather")}
                  </label>
                  <select
                    id="environment-weather"
                    className={formFieldClassName}
                    value={environmentDraft?.weatherId ?? "stable_clear"}
                    onChange={(event) => {
                      setEnvironmentDraft((current) =>
                        current
                          ? {
                              ...current,
                              weatherId: event.target.value as EnvironmentWeatherId,
                            }
                          : current
                      );
                    }}
                  >
                    {ENVIRONMENT_PRESET_OPTIONS.weather.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {selectedWeatherOption?.description}
                  </p>
                </div>
                <div>
                  <label htmlFor="environment-economy" className="text-sm font-medium">
                    {t("景气度", "Economy")}
                  </label>
                  <select
                    id="environment-economy"
                    className={formFieldClassName}
                    value={environmentDraft?.economyId ?? "steady"}
                    onChange={(event) => {
                      setEnvironmentDraft((current) =>
                        current
                          ? {
                              ...current,
                              economyId: event.target.value as EnvironmentEconomyId,
                            }
                          : current
                      );
                    }}
                  >
                    {ENVIRONMENT_PRESET_OPTIONS.economy.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {selectedEconomyOption?.description}
                  </p>
                </div>
                <div>
                  <label htmlFor="environment-event" className="text-sm font-medium">
                    {t("城市事件", "Event")}
                  </label>
                  <select
                    id="environment-event"
                    className={formFieldClassName}
                    value={environmentDraft?.eventId ?? "none"}
                    onChange={(event) => {
                      setEnvironmentDraft((current) =>
                        current
                          ? {
                              ...current,
                              eventId: event.target.value as EnvironmentEventId,
                            }
                          : current
                      );
                    }}
                  >
                    {ENVIRONMENT_PRESET_OPTIONS.event.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {selectedEventOption?.description}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-2"
                  onClick={applyRecommendedEnvironment}
                  disabled={!environmentDraft}
                >
                  <RefreshCw className="size-4" />
                  {t("按场景生成", "Generate from presets")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={applyRandomEnvironment}
                  disabled={!selectedClassId}
                >
                  <Shuffle className="size-4" />
                  {t("随机生成", "Randomize")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="gap-2"
                  onClick={resetEnvironmentDraft}
                  disabled={!environmentDraft}
                >
                  <RefreshCw className="size-4" />
                  {t("恢复已保存", "Reset")}
                </Button>
                {canSaveEnvironment ? (
                  <Button
                    type="button"
                    className="gap-2"
                    onClick={() => {
                      environmentMutation.mutate();
                    }}
                    disabled={environmentMutation.isPending || !hasUnsavedEnvironmentChanges}
                  >
                    {environmentMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    {t("保存到当前轮次", "Save to round")}
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="dashboard-panel">
                <label htmlFor="environment-season-factor" className="text-sm font-medium">
                  {t("季节系数", "Season factor")}
                </label>
                <Input
                  id="environment-season-factor"
                  className="mt-2"
                  inputMode="decimal"
                  value={environmentDraft?.seasonFactor ?? ""}
                  onChange={(event) => {
                    setEnvironmentDraft((current) =>
                      current
                        ? {
                            ...current,
                            seasonFactor: event.target.value,
                          }
                        : current
                    );
                  }}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {ENVIRONMENT_FACTOR_HINTS.seasonFactor}
                </p>
              </div>
              <div className="dashboard-panel">
                <label htmlFor="environment-economy-factor" className="text-sm font-medium">
                  {t("景气系数", "Economy factor")}
                </label>
                <Input
                  id="environment-economy-factor"
                  className="mt-2"
                  inputMode="decimal"
                  value={environmentDraft?.economyFactor ?? ""}
                  onChange={(event) => {
                    setEnvironmentDraft((current) =>
                      current
                        ? {
                            ...current,
                            economyFactor: event.target.value,
                          }
                        : current
                    );
                  }}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {ENVIRONMENT_FACTOR_HINTS.economyFactor}
                </p>
              </div>
              <div className="dashboard-panel">
                <label htmlFor="environment-event-factor" className="text-sm font-medium">
                  {t("事件系数", "Event factor")}
                </label>
                <Input
                  id="environment-event-factor"
                  className="mt-2"
                  inputMode="decimal"
                  value={environmentDraft?.eventFactor ?? ""}
                  onChange={(event) => {
                    setEnvironmentDraft((current) =>
                      current
                        ? {
                            ...current,
                            eventFactor: event.target.value,
                          }
                        : current
                    );
                  }}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {ENVIRONMENT_FACTOR_HINTS.eventFactor}
                </p>
              </div>
              <div className="dashboard-panel">
                <label htmlFor="environment-random-seed" className="text-sm font-medium">
                  {t("随机种子", "Random seed")}
                </label>
                <Input
                  id="environment-random-seed"
                  className="mt-2"
                  value={environmentDraft?.randomSeed ?? ""}
                  onChange={(event) => {
                    setEnvironmentDraft((current) =>
                      current
                        ? {
                            ...current,
                            randomSeed: event.target.value,
                          }
                        : current
                    );
                  }}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {t(
                    "填写后可复现同一套随机环境；留空则保持当前保存值。",
                    "Fill this to replay the same random environment later."
                  )}
                </p>
              </div>
            </div>

            <div className="dashboard-panel">
              <label htmlFor="environment-description" className="text-sm font-medium">
                {t("环境说明", "Environment notes")}
              </label>
              <Textarea
                id="environment-description"
                className="mt-2 min-h-[132px] border-white/10 bg-slate-950/70"
                value={environmentDraft?.eventDescription ?? ""}
                onChange={(event) => {
                  setEnvironmentDraft((current) =>
                    current
                      ? {
                          ...current,
                          eventDescription: event.target.value,
                        }
                      : current
                  );
                }}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {t(
                  "这里的说明会跟随轮次一起保存，后续对接或复盘时可直接看到本轮环境假设。",
                  "These notes persist with the round so future handoff and replay work can see the original assumption set."
                )}
              </p>
            </div>

            <div className="dashboard-panel-subtle text-sm text-muted-foreground">
              {classRecord?.currentRound && classRecord.currentRound > 0
                ? canSaveEnvironment
                  ? t(
                      "建议先保存当前环境配置，再通知学生按该环境完成本轮决策。",
                      "Save the environment fit before asking students to finalize decisions for this round."
                    )
                  : t(
                      "当前轮次不是待处理状态，因此这里只读展示其环境快照，不能再修改。",
                      "The current round is no longer pending, so this snapshot is read-only for replay integrity."
                    )
                : t(
                    "当前班级尚未初始化。第 1 轮会按这里展示的环境参数创建，你可以继续微调后再初始化。",
                    "This class is not initialized yet. Round 1 will use the environment shown here when you initialize it."
                  )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="dashboard-panel">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t("环境预览", "Environment preview")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {draftEnvironment.monthLabel} · {draftEnvironment.seasonLabel}
                  </p>
                </div>
                {renderEnvironmentOutlook()}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="dashboard-panel-subtle">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {t("季节", "Season")}
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {draftEnvironment.seasonLabel}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("季节系数", "Season factor")}:{" "}
                    {formatFactorInput(draftEnvironment.seasonFactor)}
                  </p>
                </div>
                <div className="dashboard-panel-subtle">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {t("天气", "Weather")}
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {draftEnvironment.weatherLabel}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("事件系数", "Event factor")}:{" "}
                    {formatFactorInput(draftEnvironment.eventFactor)}
                  </p>
                </div>
                <div className="dashboard-panel-subtle">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {t("景气", "Economy")}
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {draftEnvironment.economyLabel}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("景气系数", "Economy factor")}:{" "}
                    {formatFactorInput(draftEnvironment.economyFactor)}
                  </p>
                </div>
                <div className="dashboard-panel-subtle">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {t("事件", "Event")}
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {draftEnvironment.eventLabel}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("综合需求乘数", "Demand multiplier")}:{" "}
                    {formatFactorInput(draftEnvironment.totalDemandMultiplier)}
                  </p>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-muted-foreground">
                {draftEnvironment.eventDescription}
              </div>
            </div>

            <div className="dashboard-panel-subtle">
              <p className="text-sm font-medium text-foreground">
                {t("系统提示", "System guidance")}
              </p>
              <div className="mt-3 grid gap-3">
                {[
                  [t("定价提示", "Pricing"), draftEnvironment.pricingHint],
                  [t("营销提示", "Marketing"), draftEnvironment.marketingHint],
                  [t("运营提示", "Operations"), draftEnvironment.operationsHint],
                  [t("财务提示", "Finance"), draftEnvironment.financeHint],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      {label}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {(environmentMutation.error || simulationMutation.error) ? (
              <Card className="dashboard-card-alert">
                <CardContent className="p-4 text-sm text-destructive">
                  {environmentMutation.error instanceof ApiClientError
                    ? environmentMutation.error.message
                    : simulationMutation.error instanceof ApiClientError
                      ? simulationMutation.error.message
                      : t("环境参数保存失败。", "Failed to save environment parameters.")}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {(classesQuery.isLoading || classDetailQuery.isLoading || roundsQuery.isLoading) &&
      !classRecord ? (
        <Card className="dashboard-card-surface">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("正在加载模拟控制台...", "Loading simulation workspace...")}
          </CardContent>
        </Card>
      ) : classesQuery.error || classDetailQuery.error || roundsQuery.error ? (
        <Card className="dashboard-card-alert">
          <CardContent className="p-6 text-sm text-destructive">
            {(roundsQuery.error ?? classDetailQuery.error ?? classesQuery.error) instanceof
            ApiClientError
              ? (
                  (roundsQuery.error ??
                    classDetailQuery.error ??
                    classesQuery.error) as ApiClientError
                ).message
              : t("模拟控制台加载失败。", "Failed to load the simulation workspace.")}
          </CardContent>
        </Card>
      ) : !classRecord ? (
        <Card className="dashboard-card-surface">
          <CardContent className="p-6 text-sm text-muted-foreground">
            {t(
              "请选择一个班级来管理其模拟生命周期。",
              "Select a class to manage its simulation lifecycle."
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="content-auto motion-fade-up motion-fade-delay-1 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <Card className="dashboard-card-surface">
              <CardHeader>
                <CardTitle className="text-xl">{t("轮次时间线", "Round timeline")}</CardTitle>
                <CardDescription>
                  {t(
                    "这里按顺序展示班级每一轮的状态与环境快照，便于教师连续跟踪实验推进。",
                    "Track status and environment assumptions round by round from one timeline."
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {timelineRounds.length > 0 ? (
                  timelineRounds.map((round) => {
                    const roundEnvironment = describeRoundEnvironment({
                      roundNumber: round.roundNumber,
                      seasonFactor: round.seasonFactor,
                      economyFactor: round.economyFactor,
                      eventFactor: round.eventFactor,
                      eventDescription: round.eventDescription,
                      randomSeed: round.randomSeed,
                    });

                    return (
                      <div key={round.id} className="dashboard-panel">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">
                              {formatRoundLabel(round.roundNumber)}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {t("截止时间", "Deadline")} {formatDate(round.deadline)} |{" "}
                              {t("处理完成", "Processed")} {formatDate(round.processedAt)}
                            </p>
                          </div>
                          <Badge variant="outline">
                            {getRoundStatusLabel(locale, round.status)}
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                          <span>
                            {t("环境系数", "Factors")} S {formatFactorInput(round.seasonFactor)} · E{" "}
                            {formatFactorInput(round.economyFactor)} · X{" "}
                            {formatFactorInput(round.eventFactor)}
                          </span>
                          <span>
                            {roundEnvironment.weatherLabel} · {roundEnvironment.economyLabel} ·{" "}
                            {roundEnvironment.eventLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="dashboard-panel-dashed">
                    {t("该班级尚未初始化任何轮次。", "This class has not been initialized yet.")}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="dashboard-card-surface">
              <CardHeader>
                <CardTitle className="text-xl">
                  {t("当前轮次提交情况", "Current round submission state")}
                </CardTitle>
                <CardDescription>
                  {t(
                    "用于确认本轮哪些团队已经提交、哪些团队仍需跟进。",
                    "Use this view to see which teams already submitted the current round."
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {decisionsQuery.isLoading ? (
                  <div className="dashboard-panel text-sm text-muted-foreground">
                    {t("正在加载当前轮次决策...", "Loading current decisions...")}
                  </div>
                ) : (decisionsQuery.data?.decisions ?? []).length > 0 ? (
                  decisionsQuery.data?.decisions.map((decision) => (
                    <div key={decision.id} className="dashboard-panel">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{decision.team.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {decision.team.hotelName} | {t("最近更新", "Updated")}{" "}
                            {formatDate(decision.updatedAt)}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {getDecisionStatusLabel(locale, decision.status)}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="dashboard-panel-dashed">
                    {t("当前轮次还没有任何决策记录。", "No decisions exist yet for the current round.")}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="content-auto motion-fade-up motion-fade-delay-2 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <Card className="dashboard-card-surface">
              <CardHeader>
                <CardTitle className="text-xl">{t("最近结果快照", "Latest results snapshot")}</CardTitle>
                <CardDescription>
                  {t(
                    "展示最近一次已处理轮次的排行榜与关键经营指标。",
                    "Shows the most recent processed leaderboard and key operating metrics."
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {resultsQuery.isLoading ? (
                  <div className="dashboard-panel text-sm text-muted-foreground">
                    {t("正在加载最近结果...", "Loading latest results...")}
                  </div>
                ) : resultsQuery.data?.roundNumber ? (
                  <>
                    <LeaderboardChart
                      data={resultsQuery.data.leaderboard.map((entry) => ({
                        teamName: entry.team.name,
                        totalRevenue: entry.totalRevenue,
                      }))}
                    />
                    {resultsQuery.data.leaderboard.map((entry) => {
                      const detail = resultsQuery.data?.results.find(
                        (result) => result.teamId === entry.teamId
                      );

                      return (
                        <div key={entry.teamId} className="dashboard-panel">
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
                              {t("市场份额", "Market share")}{" "}
                              {formatPercent(entry.overallMarketShare)}
                            </Badge>
                          </div>
                          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                            <span>
                              {t("收入", "Revenue")} {formatCurrency(entry.totalRevenue)} |{" "}
                              {t("利润", "Profit")} {formatCurrency(entry.netProfit)}
                            </span>
                            <span>
                              {t("入住率", "Occupancy")} {formatPercent(entry.occupancyRate)} | ADR{" "}
                              {formatCurrency(entry.adr)}
                            </span>
                            <span>
                              {t("现金", "Cash")} {formatCompactCurrency(detail?.cashBalanceEnd)} |{" "}
                              {t("满意度", "Satisfaction")}{" "}
                              {formatNumber(detail?.guestSatisfactionEnd)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="dashboard-panel-dashed">
                    {t("这个班级还没有任何已处理结果。", "No processed results exist yet for this class.")}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="dashboard-card-surface">
              <CardHeader>
                <CardTitle className="text-xl">{t("酒店状态脉搏", "Hotel state pulse")}</CardTitle>
                <CardDescription>
                  {t(
                    "帮助教师在下一轮开始前快速识别现金承压、负债较高或需要重点关注的团队。",
                    "Quickly identify distressed or fast-growing teams before the next round starts."
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {classRecord.teams.map((team) => (
                  <div key={team.id} className="dashboard-panel">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{team.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {team.hotelName}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {t("现金", "Cash")} {formatCompactCurrency(team.hotelState?.cashBalance)}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                      <span>
                        {t("负债", "Debt")} {formatCompactCurrency(team.hotelState?.totalDebt)}
                      </span>
                    </div>
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
