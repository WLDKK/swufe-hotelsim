"use client";

import { useEffect, useMemo, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Download, Loader2, Save } from "lucide-react";
import { TeacherWorkspaceHero } from "@/components/teacher/teacher-workspace-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  formatNumber,
  formatPercent,
} from "@/lib/formatters";
import { useLocale } from "@/i18n/use-locale";

type TeacherGradingPanelProps = {
  initialClassId?: string;
};

type ClassesResponse = {
  classes: Array<{
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
  }>;
};

type ClassResultsResponse = {
  roundNumber: number | null;
  availableRoundNumbers: number[];
  leaderboard: Array<{
    teamId: string;
    rankOverall: number;
    rankRevenue: number;
    rankProfit: number;
    totalRevenue: number;
    netProfit: number;
    occupancyRate: number;
    adr: number;
    revpar: number;
    overallMarketShare: number;
    team: {
      id: string;
      name: string;
      hotelName: string;
      color: string;
    };
  }>;
  results: Array<{
    id: string;
    teamId: string;
    roundNumber: number;
    teacherScore: number | null;
    teacherComment: string | null;
    totalRevenue: number;
    netProfit: number;
    occupancyRate: number;
    adr: number;
    revpar: number;
    guestSatisfactionEnd: number;
    esgScoreEnd: number;
    cashBalanceEnd: number;
    team: {
      id: string;
      name: string;
      hotelName: string;
      color: string;
    };
  }>;
};

type GradingResponse = {
  result: {
    id: string;
    teacherScore: number | null;
    teacherComment: string | null;
  };
};

const selectClassName = "dashboard-select";

type DraftMap = Record<
  string,
  {
    teacherScore: string;
    teacherComment: string;
  }
>;

const teacherGradingCopy = {
  "zh-CN": {
    hero: {
      badgeLabel: "教师 / 评分",
      title: "教师评分与反馈工作区",
      description:
        "这个页面把结果复盘与教师评分收束到同一处，让教师可以直接把分数和评语写入已处理轮次结果。",
      statusTitle: "反馈闭环",
      statusBody: (roundNumber: number | null) =>
        roundNumber
          ? `当前选中的是第 ${roundNumber} 轮结果。请在这里完成评分和评语，让学生端结果页可以看到完整反馈链。`
          : "请选择一个已经有处理结果的班级与轮次，才能开启评分与评语填写。",
      summaryLabels: {
        selectedRound: "当前轮次",
        gradedTeams: "已评分团队",
        averageScore: "平均分",
        topRevenueTeam: "收入领先团队",
      },
      summaryHints: {
        selectedRound: "当前加载进评分工作区的已完成轮次。",
        gradedTeams: "已经保存教师评分的团队数。",
        averageScore: "已完成评分团队的平均分。",
        topRevenueTeam: "当前已选轮次的收入榜首团队。",
      },
      actions: {
        dashboard: "打开总览",
        classes: "打开班级",
        simulation: "打开模拟",
      },
    },
    selectors: {
      title: "评分筛选器",
      description: "当前班级与已完成轮次会共同决定哪一组结果进入教师评分区。",
      classLabel: "班级",
      roundLabel: "已完成轮次",
      download: "下载当前轮次成绩册 CSV",
    },
    feedback: {
      saved: "教师评分已保存到当前轮次结果。",
      saveError: "教师评分保存失败。",
    },
    loading: "正在加载评分工作区...",
    loadError: "教师评分数据加载失败。",
    empty: "当前还没有可供评分的已处理结果。",
    grading: {
      title: "逐团队评分",
      description: "分数和评语会保存到当前选中轮次的结果记录上，便于学生查看完整反馈。",
      revenue: "收入",
      profit: "利润",
      occupancy: "入住率",
      cash: "现金",
      guest: "宾客",
      scoreLabel: "教师评分",
      commentLabel: "教师评语",
      save: "保存评分",
    },
  },
  "en-US": {
    hero: {
      badgeLabel: "Teacher / Grading",
      title: "Teacher grading and feedback workspace",
      description:
        "This page brings result review and teacher grading together so instructors can add scores and feedback directly to processed round results.",
      statusTitle: "Feedback closure",
      statusBody: (roundNumber: number | null) =>
        roundNumber
          ? `Round ${roundNumber} is selected for feedback. Grade the processed teams here so students can see the score and comment chain in their results workspace.`
          : "Choose a class with processed results to unlock round-level grading and teacher feedback.",
      summaryLabels: {
        selectedRound: "Selected round",
        gradedTeams: "Graded teams",
        averageScore: "Average score",
        topRevenueTeam: "Top revenue team",
      },
      summaryHints: {
        selectedRound: "Current completed round loaded into the grading workspace.",
        gradedTeams: "Teams that already have a saved teacher score.",
        averageScore: "Average across the teams that have already been graded.",
        topRevenueTeam: "Leaderboard leader for the selected completed round.",
      },
      actions: {
        dashboard: "Open dashboard",
        classes: "Open classes",
        simulation: "Open simulation",
      },
    },
    selectors: {
      title: "Grading selectors",
      description:
        "The selected class and completed round define which result set is available for teacher scoring and written feedback.",
      classLabel: "Class",
      roundLabel: "Completed round",
      download: "Download the current round gradebook CSV",
    },
    feedback: {
      saved: "Teacher grading has been saved to the live results record.",
      saveError: "Failed to save teacher grading.",
    },
    loading: "Loading grading workspace...",
    loadError: "Failed to load teacher grading data.",
    empty: "No processed results are available to grade yet.",
    grading: {
      title: "Per-team grading",
      description:
        "Scores and comments are saved onto the selected round results so students can review complete feedback.",
      revenue: "Revenue",
      profit: "Profit",
      occupancy: "Occupancy",
      cash: "Cash",
      guest: "Guest",
      scoreLabel: "Teacher score",
      commentLabel: "Teacher comment",
      save: "Save grading",
    },
  },
} as const;

export function TeacherGradingPanel({
  initialClassId,
}: TeacherGradingPanelProps) {
  const { locale } = useLocale();
  const copy = teacherGradingCopy[locale];
  const heroDescription =
    locale === "zh-CN"
      ? "这个页面将结果复盘与教师评分真正闭环起来，让教师可以直接把分数和评语写入已处理轮次。"
      : "This page closes the grading loop by letting teachers add scores and feedback directly onto processed round results.";
  const queryClient = useQueryClient();
  const [selectedClassId, setSelectedClassId] = useState(initialClassId ?? "");
  const [selectedRoundNumber, setSelectedRoundNumber] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");
  const [savingResultId, setSavingResultId] = useState<string | null>(null);

  const classesQuery = useQuery({
    queryKey: ["teacher-grading-classes"],
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

  const resultsQuery = useQuery({
    queryKey: ["teacher-grading-results", selectedClassId, selectedRoundNumber],
    queryFn: () =>
      apiFetch<ClassResultsResponse>(
        selectedRoundNumber
          ? `/api/simulation/results?classId=${selectedClassId}&roundNumber=${selectedRoundNumber}`
          : `/api/simulation/results?classId=${selectedClassId}`
      ),
    enabled: Boolean(selectedClassId),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    const availableRounds = resultsQuery.data?.availableRoundNumbers ?? [];
    if (availableRounds.length === 0) {
      return;
    }

    if (!selectedRoundNumber || !availableRounds.includes(selectedRoundNumber)) {
      setSelectedRoundNumber(availableRounds[0]);
    }
  }, [resultsQuery.data?.availableRoundNumbers, selectedRoundNumber]);

  useEffect(() => {
    const nextDrafts = Object.fromEntries(
      (resultsQuery.data?.results ?? []).map((result) => [
        result.id,
        {
          teacherScore:
            typeof result.teacherScore === "number"
              ? String(result.teacherScore)
              : "",
          teacherComment: result.teacherComment ?? "",
        },
      ])
    ) as DraftMap;

    setDrafts(nextDrafts);
  }, [resultsQuery.data?.results]);

  const gradingMutation = useMutation({
    mutationFn: (payload: {
      resultId: string;
      teacherScore: number | null;
      teacherComment: string;
    }) =>
      apiFetch<GradingResponse>("/api/grading", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      setFeedbackTone("success");
      setFeedbackMessage(copy.feedback.saved);
      await queryClient.invalidateQueries({
        queryKey: ["teacher-grading-results", selectedClassId],
      });
    },
    onError: (error) => {
      setFeedbackTone("error");
      setFeedbackMessage(
        error instanceof ApiClientError
          ? error.message
          : copy.feedback.saveError
      );
    },
    onSettled: () => {
      setSavingResultId(null);
    },
  });

  const gradedCount = useMemo(
    () =>
      (resultsQuery.data?.results ?? []).filter(
        (result) => typeof result.teacherScore === "number"
      ).length,
    [resultsQuery.data?.results]
  );

  const averageTeacherScore = useMemo(() => {
    const scoredResults = (resultsQuery.data?.results ?? []).filter(
      (result) => typeof result.teacherScore === "number"
    );

    if (scoredResults.length === 0) {
      return null;
    }

    return (
      scoredResults.reduce((sum, result) => sum + (result.teacherScore ?? 0), 0) /
      scoredResults.length
    );
  }, [resultsQuery.data?.results]);

  const updateDraft = (
    resultId: string,
    field: "teacherScore" | "teacherComment",
    value: string
  ) => {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      // Preserve the other local field so typing into score/comment does not
      // wipe the sibling draft before the teacher explicitly saves.
      [resultId]: {
        ...(currentDrafts[resultId] ?? {
          teacherScore: "",
          teacherComment: "",
        }),
        [field]: value,
      },
    }));
  };

  const saveResult = (resultId: string) => {
    const draft = drafts[resultId];
    const normalizedScore = draft?.teacherScore.trim() ?? "";
    const nextTeacherScore =
      normalizedScore.length > 0 ? Number(normalizedScore) : null;

    setSavingResultId(resultId);

    gradingMutation.mutate({
      resultId,
      teacherScore: Number.isFinite(nextTeacherScore) ? nextTeacherScore : null,
      teacherComment: draft?.teacherComment ?? "",
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <TeacherWorkspaceHero
        badgeLabel={copy.hero.badgeLabel}
        title={copy.hero.title}
        description={heroDescription}
        statusTitle={copy.hero.statusTitle}
        statusBody={copy.hero.statusBody(resultsQuery.data?.roundNumber ?? null)}
        summaryItems={[
          {
            label: copy.hero.summaryLabels.selectedRound,
            value: resultsQuery.data?.roundNumber
              ? locale === "zh-CN"
                ? `第 ${resultsQuery.data.roundNumber} 轮`
                : `Round ${resultsQuery.data.roundNumber}`
              : "-",
            hint: copy.hero.summaryHints.selectedRound,
          },
          {
            label: copy.hero.summaryLabels.gradedTeams,
            value: `${gradedCount} / ${(resultsQuery.data?.results ?? []).length}`,
            hint: copy.hero.summaryHints.gradedTeams,
          },
          {
            label: copy.hero.summaryLabels.averageScore,
            value: formatNumber(averageTeacherScore),
            hint: copy.hero.summaryHints.averageScore,
          },
          {
            label: copy.hero.summaryLabels.topRevenueTeam,
            value: resultsQuery.data?.leaderboard[0]?.team.name ?? "-",
            hint: copy.hero.summaryHints.topRevenueTeam,
          },
        ]}
        actions={[
          { href: "/teacher/dashboard", label: copy.hero.actions.dashboard, variant: "default" },
          { href: "/teacher/classes", label: copy.hero.actions.classes },
          { href: "/teacher/simulation", label: copy.hero.actions.simulation },
        ]}
      />

      <Card className="dashboard-card-surface">
        <CardHeader>
          <CardTitle className="text-xl">{copy.selectors.title}</CardTitle>
          <CardDescription>
            {copy.selectors.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="teacher-grading-class" className="text-sm font-medium">
              {copy.selectors.classLabel}
            </label>
            <select
              id="teacher-grading-class"
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
          <div>
            <label htmlFor="teacher-grading-round" className="text-sm font-medium">
              {copy.selectors.roundLabel}
            </label>
            <select
              id="teacher-grading-round"
              className={selectClassName}
              value={selectedRoundNumber ?? ""}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                setSelectedRoundNumber(Number.isFinite(nextValue) ? nextValue : null);
              }}
            >
              {(resultsQuery.data?.availableRoundNumbers ?? []).map((roundNumber) => (
                <option key={roundNumber} value={roundNumber}>
                  {locale === "zh-CN" ? `第 ${roundNumber} 轮` : `Round ${roundNumber}`}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
        {selectedClassId && resultsQuery.data?.roundNumber ? (
          <CardContent className="pt-0">
            <a
              href={`/api/export/grades?classId=${selectedClassId}&roundNumber=${resultsQuery.data.roundNumber}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary"
            >
              <Download className="size-4" />
              {copy.selectors.download}
            </a>
          </CardContent>
        ) : null}
      </Card>

      {feedbackMessage ? (
        <Card
          className={
            feedbackTone === "success"
              ? "dashboard-card-success"
              : "dashboard-card-alert"
          }
        >
          <CardContent
            className={
              feedbackTone === "success"
                ? "p-6 text-sm text-emerald-700"
                : "p-6 text-sm text-destructive"
            }
          >
            {feedbackMessage}
          </CardContent>
        </Card>
      ) : null}

      {classesQuery.isLoading || resultsQuery.isLoading ? (
        <Card className="dashboard-card-surface">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {copy.loading}
          </CardContent>
        </Card>
      ) : classesQuery.error || resultsQuery.error ? (
        <Card className="dashboard-card-alert">
          <CardContent className="p-6 text-sm text-destructive">
            {(resultsQuery.error ?? classesQuery.error) instanceof ApiClientError
              ? ((resultsQuery.error ?? classesQuery.error) as ApiClientError).message
              : copy.loadError}
          </CardContent>
        </Card>
      ) : !resultsQuery.data?.roundNumber || resultsQuery.data.results.length === 0 ? (
        <Card className="dashboard-card-surface">
          <CardContent className="p-6 text-sm text-muted-foreground">
            {copy.empty}
          </CardContent>
        </Card>
      ) : (
        <Card className="dashboard-card-surface">
          <CardHeader>
            <CardTitle className="text-xl">{copy.grading.title}</CardTitle>
            <CardDescription>
              {copy.grading.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {resultsQuery.data.results.map((result) => {
              const leaderboardEntry = resultsQuery.data?.leaderboard.find(
                (entry) => entry.teamId === result.teamId
              );
              const draft = drafts[result.id] ?? {
                teacherScore: "",
                teacherComment: "",
              };

              return (
                <div
                  key={result.id}
                  // Keep a stable selector surface for the live Playwright
                  // grading flow so future layout refactors do not break the
                  // acceptance chain just because wrapper markup shifts.
                  data-testid="grading-card"
                  data-team-name={result.team.name}
                  className="dashboard-panel"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{result.team.name}</p>
                        <Badge variant="outline">
                          #{leaderboardEntry?.rankOverall ?? "-"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {result.team.hotelName}
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                      <span>
                        {copy.grading.revenue} {formatCompactCurrency(result.totalRevenue)}
                      </span>
                      <span>{copy.grading.profit} {formatCompactCurrency(result.netProfit)}</span>
                      <span>
                        {copy.grading.occupancy} {formatPercent(result.occupancyRate)}
                      </span>
                      <span>ADR {formatCurrency(result.adr)}</span>
                      <span>RevPAR {formatCurrency(result.revpar)}</span>
                      <span>{copy.grading.cash} {formatCompactCurrency(result.cashBalanceEnd)}</span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[0.35fr_0.65fr]">
                    <div>
                      <label
                        htmlFor={`teacher-score-${result.id}`}
                        className="text-sm font-medium"
                      >
                        {copy.grading.scoreLabel}
                      </label>
                      <Input
                        id={`teacher-score-${result.id}`}
                        data-testid="teacher-score-input"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={draft.teacherScore}
                        onChange={(event) => {
                          updateDraft(result.id, "teacherScore", event.target.value);
                        }}
                      />
                      <p className="mt-2 text-xs text-muted-foreground">
                        {copy.grading.guest} {formatNumber(result.guestSatisfactionEnd)} | ESG{" "}
                        {formatNumber(result.esgScoreEnd)}
                      </p>
                    </div>
                    <div>
                      <label
                        htmlFor={`teacher-comment-${result.id}`}
                        className="text-sm font-medium"
                      >
                        {copy.grading.commentLabel}
                      </label>
                      <Textarea
                        id={`teacher-comment-${result.id}`}
                        data-testid="teacher-comment-input"
                        value={draft.teacherComment}
                        onChange={(event) => {
                          updateDraft(result.id, "teacherComment", event.target.value);
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button
                      data-testid="save-grading-button"
                      className="gap-2"
                      onClick={() => {
                        saveResult(result.id);
                      }}
                      disabled={gradingMutation.isPending}
                    >
                      {gradingMutation.isPending && savingResultId === result.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Save className="size-4" />
                      )}
                      {copy.grading.save}
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
