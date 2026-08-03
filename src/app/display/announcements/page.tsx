import { DisplayShell } from "@/components/display/display-shell";
import { formatDate } from "@/lib/formatters";
import { listAnnouncements } from "@/lib/dal/competitions";

export const dynamic = "force-dynamic";

export default async function DisplayAnnouncementsPage() {
  const announcements = await listAnnouncements({ publishedOnly: true });

  return (
    <DisplayShell
      title="公告时间线"
      description="公告已经独立成正式实体。这个页面专门面向公开展示，适合在比赛现场、答辩汇报或对外演示时投屏使用，让通知、赛制说明和阶段提示都能按照时间线被更清楚地看到。"
    >
      <section className="grid gap-4">
        {announcements.length > 0 ? (
          announcements.map((announcement, index) => (
            <article
              key={announcement.id}
              className="interactive-lift motion-fade-up relative rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-6 pl-10 shadow-sm"
              style={{ animationDelay: `${100 + index * 80}ms` }}
            >
              <div className="absolute left-5 top-7 h-[calc(100%-3.5rem)] w-px bg-[linear-gradient(180deg,rgba(56,189,248,0.45),rgba(148,163,184,0.12))]" />
              <div className="absolute left-[14px] top-7 size-3 rounded-full border border-sky-200 bg-sky-500 shadow-[0_0_0_4px_rgba(224,242,254,0.9)]" />
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-slate-950">
                  {announcement.title}
                </h2>
                {announcement.isPinned ? (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                    置顶
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                发布时间 {formatDate(announcement.publishedAt ?? announcement.createdAt)}
              </p>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {announcement.content}
              </p>
            </article>
          ))
        ) : (
          <div className="motion-fade-up rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            当前暂无已发布公告。
          </div>
        )}
      </section>
    </DisplayShell>
  );
}
