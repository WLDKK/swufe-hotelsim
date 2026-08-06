import Link from "next/link";
import { CalendarClock, FileText, PenSquare, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { getJudgeDashboardSnapshot } from "@/lib/dal/competitions";

type JudgeDashboardPanelProps = {
  snapshot: Awaited<ReturnType<typeof getJudgeDashboardSnapshot>>;
};

export function JudgeDashboardPanel({ snapshot }: JudgeDashboardPanelProps) {
  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-sky-200/70 bg-white/95">
          <CardHeader className="pb-3">
            <CardDescription>当前比赛</CardDescription>
            <CardTitle className="text-xl">
              {snapshot.activeCompetition?.name ?? "尚未配置"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-slate-600">
            {snapshot.activeCompetition ? (
              <>
                <p>代码：{snapshot.activeCompetition.code}</p>
                <p className="mt-1">
                  规则集：
                  {snapshot.activeCompetition.ruleset
                    ? `${snapshot.activeCompetition.ruleset.name} ${snapshot.activeCompetition.ruleset.version}`
                    : "未绑定"}
                </p>
              </>
            ) : (
              <p>比赛实体已建模，但当前还没有处于 READY / ACTIVE 状态的比赛。</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-sky-200/70 bg-white/95">
          <CardHeader className="pb-3">
            <CardDescription>待评分条目</CardDescription>
            <CardTitle className="text-3xl">{snapshot.pendingScoreCount}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-slate-600">
            按最新比赛轮次估算当前裁判尚未提交的评分记录数。
          </CardContent>
        </Card>

        <Card className="border-sky-200/70 bg-white/95">
          <CardHeader className="pb-3">
            <CardDescription>最近评分</CardDescription>
            <CardTitle className="text-3xl">{snapshot.recentScores.length}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-slate-600">
            最近 8 条由当前裁判提交或更新的评分记录。
          </CardContent>
        </Card>

        <Card className="border-sky-200/70 bg-white/95">
          <CardHeader className="pb-3">
            <CardDescription>公告同步</CardDescription>
            <CardTitle className="text-3xl">{snapshot.recentAnnouncements.length}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-slate-600">
            裁判台与公开展示页复用同一组公告实体。
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-sky-200/70 bg-white/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <CalendarClock className="size-5 text-sky-600" />
              最近比赛轮次
            </CardTitle>
            <CardDescription>
              这里读取 Competition / Stage / Round 的正式比赛实体链，供裁判快速确认当前评分上下文。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {snapshot.latestCompetitionRound ? (
              <div className="rounded-2xl border border-sky-200/70 bg-sky-50/50 p-4 text-sm text-slate-700">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold text-slate-950">
                    {snapshot.latestCompetitionRound.competitionStage?.competition.name}
                  </p>
                  <Badge variant="outline">
                    Stage {snapshot.latestCompetitionRound.competitionStage?.stageOrder ?? "-"}
                  </Badge>
                  <Badge variant="outline">
                    Round {snapshot.latestCompetitionRound.roundNumber}
                  </Badge>
                </div>
                <p className="mt-2">
                  阶段：{snapshot.latestCompetitionRound.competitionStage?.name ?? "未绑定"}
                </p>
                <p className="mt-1">班级：{snapshot.latestCompetitionRound.class.name}</p>
                <p className="mt-1">
                  处理时间：
                  {formatDate(snapshot.latestCompetitionRound.processedAt)}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                当前还没有进入已处理状态的正式比赛轮次。
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Link
                href="/judge/scoring"
                className={cn(buttonVariants({ size: "sm" }), "gap-2")}
              >
                <PenSquare className="size-4" />
                进入裁判评分
              </Link>
              <Link
                href="/display/leaderboard"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}
              >
                <Trophy className="size-4" />
                查看公开排行榜
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border-sky-200/70 bg-white/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <FileText className="size-5 text-sky-600" />
              最新公告
            </CardTitle>
            <CardDescription>
              这里汇总与你获分配赛事有关的已发布公告与阶段提醒。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.recentAnnouncements.length > 0 ? (
              snapshot.recentAnnouncements.map((announcement) => (
                <div
                  key={announcement.id}
                  className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-950">{announcement.title}</p>
                    {announcement.isPinned ? <Badge>置顶</Badge> : null}
                    {announcement.isPublished ? (
                      <Badge variant="outline">已发布</Badge>
                    ) : (
                      <Badge variant="outline">草稿</Badge>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                    {announcement.content}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                当前没有公告记录。
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="border-sky-200/70 bg-white/95">
        <CardHeader>
          <CardTitle className="text-xl">最近评分记录</CardTitle>
          <CardDescription>
            用于人工验收裁判链是否真正落库，并与 RoundResult 的聚合字段联动。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {snapshot.recentScores.length > 0 ? (
            snapshot.recentScores.map((score) => (
              <div
                key={score.id}
                className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-sm text-slate-700"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-950">
                    {score.result.team.name} / Round {score.result.roundNumber}
                  </p>
                  <Badge variant="outline">
                    {typeof score.score === "number" ? `${score.score.toFixed(1)} 分` : "仅评语"}
                  </Badge>
                </div>
                <p className="mt-1">
                  {score.result.round.class.name} · {score.result.team.hotelName}
                </p>
                <p className="mt-1 text-slate-500">
                  最后更新：{formatDate(score.updatedAt)}
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
              当前裁判还没有提交评分记录。
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
