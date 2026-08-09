"use client";

import { useEffect, useMemo, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
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

type JudgeScoringPanelProps = {
  currentUserId: string;
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
    totalRevenue: number;
    netProfit: number;
    occupancyRate: number;
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
    totalRevenue: number;
    netProfit: number;
    occupancyRate: number;
    adr: number;
    revpar: number;
    guestSatisfactionEnd: number;
    esgScoreEnd: number;
    cashBalanceEnd: number;
    systemScore: number | null;
    judgeScoreAverage: number | null;
    judgeScoreCount: number;
    finalScore: number | null;
    explanationLog: unknown;
    team: {
      id: string;
      name: string;
      hotelName: string;
      color: string;
    };
  }>;
};

type JudgeScoresResponse = {
  result: ClassResultsResponse["results"][number] & {
    explanationLog: unknown;
    systemScoreBreakdown: unknown;
  };
  judgeScores: Array<{
    id: string;
    judgeId: string;
    score: number | null;
    comment: string | null;
    breakdown: Record<string, unknown> | null;
    updatedAt: string;
    judge: {
      id: string;
      name: string | null;
      email: string;
      role: string;
    };
  }>;
};

type JudgeScoreMutationResponse = {
  result: JudgeScoresResponse["result"];
  judgeScores: JudgeScoresResponse["judgeScores"];
};

const selectClassName =
  "mt-2 flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function JudgeScoringPanel({ currentUserId }: JudgeScoringPanelProps) {
  const queryClient = useQueryClient();
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedRoundNumber, setSelectedRoundNumber] = useState<number | null>(null);
  const [selectedResultId, setSelectedResultId] = useState("");
  const [scoreDraft, setScoreDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");

  const classesQuery = useQuery({
    queryKey: ["judge-scoring-classes"],
    queryFn: () => apiFetch<ClassesResponse>("/api/classes"),
  });

  const classes = useMemo(
    () => classesQuery.data?.classes ?? [],
    [classesQuery.data?.classes]
  );

  useEffect(() => {
    if (!selectedClassId && classes.length > 0) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  const resultsQuery = useQuery({
    queryKey: ["judge-scoring-results", selectedClassId, selectedRoundNumber],
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
    const availableResults = resultsQuery.data?.results ?? [];
    if (availableResults.length === 0) {
      return;
    }

    if (!availableResults.some((result) => result.id === selectedResultId)) {
      setSelectedResultId(availableResults[0].id);
    }
  }, [resultsQuery.data?.results, selectedResultId]);

  const detailQuery = useQuery({
    queryKey: ["judge-score-detail", selectedResultId],
    queryFn: () =>
      apiFetch<JudgeScoresResponse>(`/api/judge-scores?resultId=${selectedResultId}`),
    enabled: Boolean(selectedResultId),
  });

  const currentJudgeScore = useMemo(
    () =>
      detailQuery.data?.judgeScores.find((score) => score.judgeId === currentUserId) ?? null,
    [currentUserId, detailQuery.data?.judgeScores]
  );

  useEffect(() => {
    setScoreDraft(
      typeof currentJudgeScore?.score === "number" ? String(currentJudgeScore.score) : ""
    );
    setCommentDraft(currentJudgeScore?.comment ?? "");
  }, [currentJudgeScore?.comment, currentJudgeScore?.score, selectedResultId]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch<JudgeScoreMutationResponse>("/api/judge-scores", {
        method: "PATCH",
        body: JSON.stringify({
          resultId: selectedResultId,
          score: scoreDraft.trim().length > 0 ? Number(scoreDraft) : null,
          comment: commentDraft.trim().length > 0 ? commentDraft : null,
        }),
      }),
    onSuccess: async () => {
      setFeedbackTone("success");
      setFeedbackMessage("裁判评分已保存，并已同步更新结果聚合分数。");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["judge-scoring-results", selectedClassId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["judge-score-detail", selectedResultId],
        }),
      ]);
    },
    onError: (error) => {
      setFeedbackTone("error");
      setFeedbackMessage(
        error instanceof ApiClientError ? error.message : "裁判评分保存失败。"
      );
    },
  });

  const selectedLeaderboardEntry = resultsQuery.data?.leaderboard.find(
    (entry) => entry.teamId === detailQuery.data?.result.teamId
  );

  const explanationPreview =
    detailQuery.data?.result.explanationLog &&
    typeof detailQuery.data.result.explanationLog === "object"
      ? JSON.stringify(detailQuery.data.result.explanationLog, null, 2)
      : null;

  return (
    <div className="grid gap-6">
      <Card className="border-sky-200/70 bg-white/95">
        <CardHeader>
          <CardTitle className="text-xl">赛事评分</CardTitle>
          <CardDescription>
            选择已分配赛事的班级、轮次与参赛队，查看系统经营结果并提交评审分数与意见。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="judge-class" className="text-sm font-medium">
              班级
            </label>
            <select
              id="judge-class"
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
            <label htmlFor="judge-round" className="text-sm font-medium">
              已完成轮次
            </label>
            <select
              id="judge-round"
              className={selectClassName}
              value={selectedRoundNumber ?? ""}
              onChange={(event) => {
                const nextRound = Number(event.target.value);
                setSelectedRoundNumber(Number.isFinite(nextRound) ? nextRound : null);
              }}
            >
              {(resultsQuery.data?.availableRoundNumbers ?? []).map((roundNumber) => (
                <option key={roundNumber} value={roundNumber}>
                  第 {roundNumber} 轮
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {feedbackMessage ? (
        <Card
          className={
            feedbackTone === "success"
              ? "border-emerald-500/40 bg-background/95 shadow-sm"
              : "border-destructive/40 bg-background/95 shadow-sm"
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

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-sky-200/70 bg-white/95">
          <CardHeader>
            <CardTitle className="text-xl">待评分结果列表</CardTitle>
            <CardDescription>
              左侧切换队伍结果，右侧查看解释日志和当前裁判评分内容。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {classesQuery.isLoading || resultsQuery.isLoading ? (
              <div className="flex items-center gap-3 p-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                正在加载评分数据...
              </div>
            ) : resultsQuery.error ? (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                {resultsQuery.error instanceof ApiClientError
                  ? resultsQuery.error.message
                  : "结果列表加载失败。"}
              </div>
            ) : resultsQuery.data?.results.length ? (
              resultsQuery.data.results.map((result) => {
                const active = result.id === selectedResultId;
                const leaderboardEntry = resultsQuery.data.leaderboard.find(
                  (entry) => entry.teamId === result.teamId
                );

                return (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => {
                      setSelectedResultId(result.id);
                    }}
                    className={
                      active
                        ? "w-full rounded-2xl border border-sky-400/70 bg-sky-50 p-4 text-left shadow-sm"
                        : "w-full rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-left transition hover:border-sky-200 hover:bg-sky-50/40"
                    }
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-950">{result.team.name}</p>
                      <Badge variant="outline">
                        #{leaderboardEntry?.rankOverall ?? "-"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{result.team.hotelName}</p>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                      <span>系统分：{formatNumber(result.systemScore)}</span>
                      <span>综合分：{formatNumber(result.finalScore)}</span>
                      <span>收入：{formatCompactCurrency(result.totalRevenue)}</span>
                      <span>利润：{formatCompactCurrency(result.netProfit)}</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                当前班级还没有可评分的已处理结果。
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-sky-200/70 bg-white/95">
          <CardHeader>
            <CardTitle className="text-xl">结果详情与裁判评分</CardTitle>
            <CardDescription>
              系统分解与经营解释来自本轮固化数据，可用于核对评分依据与异常指标。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {detailQuery.isLoading ? (
              <div className="flex items-center gap-3 p-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                正在加载结果详情...
              </div>
            ) : detailQuery.error ? (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                {detailQuery.error instanceof ApiClientError
                  ? detailQuery.error.message
                  : "结果详情加载失败。"}
              </div>
            ) : detailQuery.data ? (
              <>
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold text-slate-950">
                      {detailQuery.data.result.team.name}
                    </p>
                    <Badge variant="outline">
                      综合排名 #{selectedLeaderboardEntry?.rankOverall ?? "-"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {detailQuery.data.result.team.hotelName} · 第 {detailQuery.data.result.roundNumber} 轮
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                      <p>系统分：{formatNumber(detailQuery.data.result.systemScore)}</p>
                      <p className="mt-1">
                        裁判均分：{formatNumber(detailQuery.data.result.judgeScoreAverage)}
                      </p>
                      <p className="mt-1">
                        已评分裁判数：{detailQuery.data.result.judgeScoreCount}
                      </p>
                      <p className="mt-1">
                        当前综合分：{formatNumber(detailQuery.data.result.finalScore)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                      <p>收入：{formatCompactCurrency(detailQuery.data.result.totalRevenue)}</p>
                      <p className="mt-1">
                        利润：{formatCompactCurrency(detailQuery.data.result.netProfit)}
                      </p>
                      <p className="mt-1">
                        入住率：{formatPercent(detailQuery.data.result.occupancyRate)}
                      </p>
                      <p className="mt-1">ADR：{formatCurrency(detailQuery.data.result.adr)}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                    <span>RevPAR：{formatCurrency(detailQuery.data.result.revpar)}</span>
                    <span>顾客满意度：{formatNumber(detailQuery.data.result.guestSatisfactionEnd)}</span>
                    <span>ESG：{formatNumber(detailQuery.data.result.esgScoreEnd)}</span>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div>
                    <label htmlFor="judge-score" className="text-sm font-medium">
                      裁判评分
                    </label>
                    <Input
                      id="judge-score"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={scoreDraft}
                      onChange={(event) => {
                        setScoreDraft(event.target.value);
                      }}
                    />
                  </div>
                  <div>
                    <label htmlFor="judge-comment" className="text-sm font-medium">
                      裁判评语
                    </label>
                    <Textarea
                      id="judge-comment"
                      value={commentDraft}
                      onChange={(event) => {
                        setCommentDraft(event.target.value);
                      }}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      className="gap-2"
                      disabled={saveMutation.isPending || !selectedResultId}
                      onClick={() => {
                        saveMutation.mutate();
                      }}
                    >
                      {saveMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Save className="size-4" />
                      )}
                      保存裁判评分
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
                  <p className="text-sm font-medium text-slate-950">解释日志预览</p>
                  {explanationPreview ? (
                    <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                      {explanationPreview}
                    </pre>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">
                      当前结果还没有 explanationLog 内容。
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                请先从左侧选择一条结果。
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
