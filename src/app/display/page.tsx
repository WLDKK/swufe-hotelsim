import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Megaphone,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { DisplayStoryCarousel } from "@/components/display/display-story-carousel";
import { DisplayShell } from "@/components/display/display-shell";
import { Badge } from "@/components/ui/badge";
import { buildDisplayStorylines } from "@/lib/display/storylines";
import {
  formatCompactCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/lib/formatters";
import {
  getActiveCompetition,
  getDisplayLeaderboardSnapshot,
  listAnnouncements,
} from "@/lib/dal/competitions";
import { describeRoundEnvironment } from "@/lib/simulation/environment";

export const dynamic = "force-dynamic";

export default async function DisplayHomePage() {
  const [competitionResult, leaderboardResult, announcementsResult] = await Promise.allSettled([
    getActiveCompetition(),
    getDisplayLeaderboardSnapshot(),
    listAnnouncements({ publishedOnly: true }),
  ]);
  const competition = competitionResult.status === "fulfilled" ? competitionResult.value : null;
  const leaderboardSnapshot = leaderboardResult.status === "fulfilled"
    ? leaderboardResult.value
    : { snapshot: null, leaderboard: [] };
  const announcements = announcementsResult.status === "fulfilled" ? announcementsResult.value : [];
  const dataAvailable = [competitionResult, leaderboardResult, announcementsResult].every(
    (result) => result.status === "fulfilled"
  );

  const snapshot = leaderboardSnapshot.snapshot;
  const leaderboard = leaderboardSnapshot.leaderboard;
  const topTeam = leaderboard[0] ?? null;
  const secondTeam = leaderboard[1] ?? null;
  const recentAnnouncements = announcements.slice(0, 4);
  const environment =
    snapshot &&
    "seasonFactor" in snapshot &&
    "economyFactor" in snapshot &&
    "eventFactor" in snapshot
      ? describeRoundEnvironment({
          roundNumber: snapshot.roundNumber,
          seasonFactor: snapshot.seasonFactor,
          economyFactor: snapshot.economyFactor,
          eventFactor: snapshot.eventFactor,
          eventDescription: snapshot.eventDescription,
          randomSeed: snapshot.randomSeed,
        })
      : null;
  const stories = buildDisplayStorylines({
    snapshot,
    leaderboard,
    announcements,
    environment,
  });
  const scoreGap =
    topTeam && secondTeam
      ? Math.max(0, (topTeam.finalScore ?? 0) - (secondTeam.finalScore ?? 0))
      : null;

  const summaryCards = [
    {
      label: "当前赛事",
      value: competition?.name ?? "教学展示模式",
      hint:
        competition?.code ??
        "未启用正式赛事时，公开端展示最近完成的教学轮次。",
    },
    {
      label: "最新公开轮次",
      value: snapshot ? `第 ${snapshot.roundNumber} 轮` : "暂无结果",
      hint: snapshot?.class?.name ?? "等待轮次处理完成后自动更新。",
    },
    {
      label: "公开公告数",
      value: String(announcements.length),
      hint:
        announcements.length > 0
          ? "已发布公告会同步到公开展示端。"
          : "当前还没有公开公告。",
    },
    {
      label: "当前参赛队伍",
      value: String(leaderboard.length),
      hint:
        leaderboard.length > 0
          ? "排行榜基于最新可公开轮次自动生成。"
          : "等待首轮结果生成后自动补齐。",
    },
  ] as const;

  return (
    <DisplayShell
      title="酒店经营模拟比赛公开看板"
      description="集中展示已发布的赛事进度、最新轮次、排行榜、经营环境与赛事公告。"
    >
      {!dataAvailable ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900" role="status">
          部分实时数据暂时不可用，页面已切换到安全降级模式。请稍后刷新。
        </div>
      ) : null}
      <section className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
        <div className="surface-sheen motion-fade-up rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.96),rgba(30,41,59,0.92))] p-7 text-white shadow-[0_28px_90px_-48px_rgba(15,23,42,0.56)]">
          <Badge className="rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/10">
            Competition Pulse
          </Badge>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">赛事进度与领先态势</h2>
          <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-200">
            公开数据与后台操作分离。观众可在此查看最新赛况，参赛与评审操作仍需登录并通过权限校验。
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="interactive-lift rounded-[1.5rem] border border-white/12 bg-white/8 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-300">当前榜首</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {topTeam?.team.name ?? "等待揭榜"}
              </p>
              <p className="mt-2 text-xs leading-6 text-slate-300">
                {topTeam
                  ? `${topTeam.team.hotelName} 当前综合排名 #${topTeam.rankOverall}`
                  : "等待第一轮可公开结果生成。"}
              </p>
            </div>
            <div className="interactive-lift rounded-[1.5rem] border border-white/12 bg-white/8 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-300">领先优势</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {scoreGap !== null ? formatNumber(scoreGap) : "-"}
              </p>
              <p className="mt-2 text-xs leading-6 text-slate-300">
                {scoreGap !== null
                  ? "榜首与第二名之间的综合分差。"
                  : "当前还没有足够数据判断领先差距。"}
              </p>
            </div>
            <div className="interactive-lift rounded-[1.5rem] border border-white/12 bg-white/8 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-300">最近更新</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {snapshot?.processedAt ? formatDate(snapshot.processedAt) : "等待更新"}
              </p>
              <p className="mt-2 text-xs leading-6 text-slate-300">
                新轮次处理完成后，公开看板会自动切换到新的赛况播报。
              </p>
            </div>
          </div>
        </div>

        <DisplayStoryCarousel stories={stories} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card, index) => (
          <div
            key={card.label}
            className="interactive-lift motion-fade-up rounded-[1.75rem] border border-sky-200/70 bg-white/95 p-5 shadow-sm"
            style={{ animationDelay: `${120 + index * 70}ms` }}
          >
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">{card.value}</p>
            <p className="mt-2 text-sm leading-7 text-slate-600">{card.hint}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
        <div className="motion-fade-up rounded-[1.8rem] border border-slate-200/80 bg-white/95 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Trophy className="size-5 text-sky-600" />
              <div>
                <h2 className="text-xl font-semibold text-slate-950">排行榜预览</h2>
                <p className="mt-1 text-sm text-slate-500">
                  适合现场快速展示当前头部队伍的竞争态势。
                </p>
              </div>
            </div>
            <Link
              href="/display/leaderboard"
              className="inline-flex items-center gap-2 text-sm font-medium text-sky-700 transition hover:text-sky-800"
            >
              打开完整排行榜
              <ArrowRight className="size-4" />
            </Link>
          </div>

          {leaderboard.length > 0 ? (
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="px-4">排名</th>
                    <th className="px-4">队伍</th>
                    <th className="px-4">综合分</th>
                    <th className="px-4">营收</th>
                    <th className="px-4">利润</th>
                    <th className="px-4">入住率</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.slice(0, 5).map((entry) => (
                    <tr
                      key={entry.id}
                      className="rounded-2xl bg-[linear-gradient(90deg,rgba(248,250,252,0.96),rgba(239,246,255,0.88))] text-slate-700"
                    >
                      <td className="rounded-l-2xl px-4 py-4 font-semibold text-slate-950">
                        #{entry.rankOverall}
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-semibold text-slate-950">{entry.team.name}</p>
                          <p className="text-xs text-slate-500">{entry.team.hotelName}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">{formatNumber(entry.finalScore ?? 0)}</td>
                      <td className="px-4 py-4">{formatCompactCurrency(entry.totalRevenue)}</td>
                      <td className="px-4 py-4">{formatCompactCurrency(entry.netProfit)}</td>
                      <td className="rounded-r-2xl px-4 py-4">
                        {formatPercent(entry.occupancyRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-5 rounded-[1.35rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
              当前还没有可公开展示的排行榜结果。
            </div>
          )}
        </div>

        <div className="grid gap-4">
          <div className="motion-fade-up rounded-[1.8rem] border border-slate-200/80 bg-white/95 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-5 text-sky-600" />
              <div>
                <h2 className="text-xl font-semibold text-slate-950">本轮环境信号</h2>
                <p className="mt-1 text-sm text-slate-500">
                  把系统内部环境参数翻译成观众也能看懂的回合提示。
                </p>
              </div>
            </div>

            {environment ? (
              <div className="mt-5 space-y-3">
                <div className="rounded-[1.35rem] border border-slate-200/70 bg-slate-50/80 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="rounded-full border-sky-200/80 bg-sky-50 text-sky-800"
                    >
                      {environment.monthLabel}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="rounded-full border-slate-200 bg-white text-slate-700"
                    >
                      {environment.seasonLabel}
                    </Badge>
                  </div>
                  <p className="mt-3 text-lg font-semibold text-slate-950">
                    {environment.weatherLabel} / {environment.economyLabel} /{" "}
                    {environment.eventLabel}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {environment.suggestionReason}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1.15rem] border border-slate-200/70 bg-slate-50/80 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">S</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {environment.seasonFactor.toFixed(3)}
                    </p>
                  </div>
                  <div className="rounded-[1.15rem] border border-slate-200/70 bg-slate-50/80 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">E</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {environment.economyFactor.toFixed(3)}
                    </p>
                  </div>
                  <div className="rounded-[1.15rem] border border-slate-200/70 bg-slate-50/80 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">X</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {environment.eventFactor.toFixed(3)}
                    </p>
                  </div>
                </div>
                <div className="rounded-[1.15rem] border border-slate-200/70 bg-slate-50/80 p-4 text-sm leading-7 text-slate-600">
                  <p>
                    <span className="font-semibold text-slate-900">定价提示：</span>
                    {environment.pricingHint}
                  </p>
                  <p className="mt-2">
                    <span className="font-semibold text-slate-900">运营提示：</span>
                    {environment.operationsHint}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-[1.35rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                当前轮次还没有可展示的环境数据。
              </div>
            )}
          </div>

          <div className="motion-fade-up rounded-[1.8rem] border border-slate-200/80 bg-white/95 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CalendarClock className="size-5 text-sky-600" />
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">公告时间线</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    公告会同步进入公开端，适合现场播报和阶段提醒。
                  </p>
                </div>
              </div>
              <Link
                href="/display/announcements"
                className="text-sm font-medium text-sky-700 transition hover:text-sky-800"
              >
                查看全部
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {recentAnnouncements.length > 0 ? (
                recentAnnouncements.map((announcement, index) => (
                  <article
                    key={announcement.id}
                    className="interactive-lift rounded-[1.35rem] border border-slate-200/70 bg-slate-50/80 p-4"
                    style={{ animationDelay: `${120 + index * 70}ms` }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Megaphone className="size-4 text-sky-600" />
                      <h3 className="font-semibold text-slate-950">{announcement.title}</h3>
                      {announcement.isPinned ? (
                        <Badge
                          variant="outline"
                          className="rounded-full border-sky-200/80 bg-sky-50 text-sky-800"
                        >
                          置顶
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                      {formatDate(announcement.publishedAt ?? announcement.createdAt)}
                    </p>
                    <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-600">
                      {announcement.content}
                    </p>
                  </article>
                ))
              ) : (
                <div className="rounded-[1.35rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                  当前还没有公开公告，后续发布后这里会自动同步。
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

    </DisplayShell>
  );
}
