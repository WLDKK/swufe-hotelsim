import Link from "next/link";
import { FileText, LogIn, Presentation, Trophy } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DisplayShellProps = { title: string; description: string; children: React.ReactNode };

const navItems = [
  { href: "/display", label: "赛事总览", icon: Presentation },
  { href: "/display/leaderboard", label: "公开排行榜", icon: Trophy },
  { href: "/display/announcements", label: "赛事公告", icon: FileText },
] as const;

export function DisplayShell({ title, description, children }: DisplayShellProps) {
  return (
    <main className="min-h-screen bg-swufe-cream">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-5 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="grid size-11 shrink-0 place-items-center rounded-lg bg-swufe-red text-sm font-bold text-white" aria-label="返回首页">财</Link>
            <div>
              <p className="text-xs font-bold tracking-[0.12em] text-swufe-red">SWUFE HOTELSIM · PUBLIC</p>
              <h1 className="mt-1 text-xl font-bold text-swufe-blue">{title}</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>
            </div>
          </div>
          <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "gap-2 self-start lg:self-auto")}><LogIn className="size-4" />登录工作区</Link>
        </div>
        <nav aria-label="公开赛事导航" className="mx-auto flex w-full max-w-[96rem] gap-2 overflow-x-auto px-5 pb-4 sm:px-8">
          {navItems.map((item) => {
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} className="inline-flex min-h-11 min-w-max items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:border-swufe-red/30 hover:text-swufe-red"><Icon className="size-4" />{item.label}</Link>;
          })}
        </nav>
      </header>
      <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 xl:px-8">{children}</div>
    </main>
  );
}
