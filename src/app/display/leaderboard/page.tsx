import { DisplayShell } from "@/components/display/display-shell";
import {
  formatCompactCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/lib/formatters";
import { getDisplayLeaderboardSnapshot } from "@/lib/dal/competitions";

export const dynamic = "force-dynamic";

export default async function DisplayLeaderboardPage() {
  const { snapshot, leaderboard } = await getDisplayLeaderboardSnapshot();
  const topEntries = leaderboard.slice(0, 3);
  const maxScore = leaderboard[0]?.finalScore ?? 1;

  return (
    <DisplayShell
      title="公开排行榜"
      description="这里集中展示当前可公开的最新轮次结果。页面优先读取正式比赛链路里的已完成轮次；如果正式比赛数据尚未完整，也会自动回退到最新教学轮次，保证展示页始终可用。"
    >
      <section className="motion-fade-up rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold text-slate-950">
            {snapshot ? `第 ${snapshot.roundNumber} 轮公开成绩` : "暂无排行榜数据"}
          </h2>
          {snapshot?.class ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
              {snapshot.class.name}
            </span>
          ) : null}
          {snapshot?.processedAt ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
              更新于 {formatDate(snapshot.processedAt)}
            </span>
          ) : null}
        </div>

        {topEntries.length > 0 ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {topEntries.map((entry, index) => {
              const finalScore = entry.finalScore ?? 0;

              return (
                <div
                  key={entry.id}
                  className="interactive-lift motion-fade-up rounded-[1.75rem] border border-slate-200/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(239,246,255,0.88))] p-5 shadow-[0_20px_48px_-36px_rgba(15,23,42,0.28)]"
                  style={{ animationDelay: `${120 + index * 90}ms` }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
                      TOP {index + 1}
                    </span>
                    <span className="text-sm font-medium text-slate-500">
                      综合分 {formatNumber(finalScore)}
                    </span>
                  </div>
                  <p className="mt-4 text-xl font-semibold text-slate-950">
                    {entry.team.name}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">{entry.team.hotelName}</p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#0f4c81,#36a2eb)]"
                      style={{
                        width: `${Math.max(
                          18,
                          Math.min(100, (finalScore / maxScore) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-slate-400">营收</p>
                      <p className="mt-1 font-medium text-slate-800">
                        {formatCompactCurrency(entry.totalRevenue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">利润</p>
                      <p className="mt-1 font-medium text-slate-800">
                        {formatCompactCurrency(entry.netProfit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">入住率</p>
                      <p className="mt-1 font-medium text-slate-800">
                        {formatPercent(entry.occupancyRate)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {leaderboard.length > 0 ? (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-4">排名</th>
                  <th className="px-4">队伍</th>
                  <th className="px-4">综合分</th>
                  <th className="px-4">营收</th>
                  <th className="px-4">利润</th>
                  <th className="px-4">入住率</th>
                  <th className="px-4">系统分</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry) => (
                  <tr
                    key={entry.id}
                    className={
                      entry.rankOverall <= 3
                        ? "rounded-2xl bg-[linear-gradient(90deg,rgba(239,246,255,0.9),rgba(255,255,255,0.98))] text-slate-700"
                        : "rounded-2xl bg-slate-50/80 text-slate-700"
                    }
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
                    <td className="px-4 py-4">
                      {formatCompactCurrency(entry.totalRevenue)}
                    </td>
                    <td className="px-4 py-4">
                      {formatCompactCurrency(entry.netProfit)}
                    </td>
                    <td className="px-4 py-4">
                      {formatPercent(entry.occupancyRate)}
                    </td>
                    <td className="rounded-r-2xl px-4 py-4">
                      {formatNumber(entry.systemScore)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
            当前还没有可公开展示的排行榜结果。
          </div>
        )}
      </section>
    </DisplayShell>
  );
}
