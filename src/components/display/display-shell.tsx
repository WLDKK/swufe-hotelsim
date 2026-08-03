import Link from "next/link";
import { Building2, FileText, Presentation, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type DisplayShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

const navItems = [
  {
    href: "/display",
    label: "赛事总览",
    icon: Presentation,
  },
  {
    href: "/display/leaderboard",
    label: "公开排行榜",
    icon: Trophy,
  },
  {
    href: "/display/announcements",
    label: "公告时间线",
    icon: FileText,
  },
] as const;

export function DisplayShell({
  title,
  description,
  children,
}: DisplayShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_16%_16%,rgba(14,165,233,0.14),transparent_22%),radial-gradient(circle_at_86%_8%,rgba(59,130,246,0.12),transparent_18%),radial-gradient(circle_at_50%_100%,rgba(244,114,182,0.08),transparent_24%),linear-gradient(180deg,rgba(4,10,21,0.98),rgba(10,17,32,1)_42%,rgba(3,6,12,1))]">
      <div
        aria-hidden
        className="motion-float pointer-events-none absolute left-[-12rem] top-20 size-[26rem] rounded-full bg-sky-400/18 blur-3xl"
      />
      <div
        aria-hidden
        className="motion-float pointer-events-none absolute right-[-10rem] top-14 size-[22rem] rounded-full bg-fuchsia-400/14 blur-3xl"
        style={{ animationDelay: "1.2s" }}
      />

      <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 xl:px-8 2xl:px-10">
        <header className="surface-sheen motion-fade-up overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/60 shadow-[0_32px_90px_-50px_rgba(2,6,23,0.82)] backdrop-blur-xl">
          <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge className="rounded-full border border-sky-300/20 bg-sky-300/10 text-sky-100">
                  赛事展示模式
                </Badge>
                <Badge className="rounded-full border border-emerald-300/20 bg-emerald-300/10 text-emerald-100">
                  实时业务数据
                </Badge>
                <Badge className="rounded-full border border-fuchsia-300/20 bg-fuchsia-300/10 text-fuchsia-100">
                  对外演示友好
                </Badge>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-[1rem] border border-white/10 bg-white/8 text-sky-100 shadow-[0_18px_36px_-24px_rgba(56,189,248,0.4)]">
                  <Building2 className="size-6" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium tracking-[0.2em] text-slate-400">
                    SWUFE HOTELSIM
                  </p>
                  <h1 className="text-3xl font-semibold tracking-tight text-white">
                    {title}
                  </h1>
                  <p className="max-w-3xl text-sm leading-7 text-slate-300">
                    {description}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {navItems.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="interactive-lift inline-flex items-center justify-center gap-2 rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-sky-300/30 hover:bg-white/10"
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </header>

        {children}
      </div>
    </main>
  );
}
