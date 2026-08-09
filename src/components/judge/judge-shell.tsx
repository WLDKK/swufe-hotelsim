"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gavel, Home, LayoutDashboard, PenSquare, Trophy } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const judgeNavItems = [
  { href: "/judge/dashboard", label: "评审总览", icon: LayoutDashboard },
  { href: "/judge/scoring", label: "赛事评分", icon: PenSquare },
] as const;

type JudgeShellProps = { userName: string; userEmail: string; children: React.ReactNode };

export function JudgeShell({ userName, userEmail, children }: JudgeShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-swufe-cream">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 w-full max-w-[96rem] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="grid size-10 place-items-center rounded-lg bg-swufe-red text-xs font-bold text-white" aria-label="返回首页">财</Link>
            <div><p className="text-sm font-bold text-swufe-blue">SWUFE HotelSim</p><p className="text-xs text-slate-500">赛事评审工作台</p></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden text-right md:block"><p className="text-sm font-semibold text-slate-800">{userName}</p><p className="text-xs text-slate-500">{userEmail}</p></div>
            <Link href="/display" className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }))} aria-label="公开赛况"><Trophy className="size-4" /></Link>
            <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))} aria-label="首页"><Home className="size-4" /></Link>
            <SignOutButton className="border-slate-300 bg-white text-slate-700" label="退出" />
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[96rem] lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-white p-3 lg:min-h-[calc(100vh-4rem)] lg:border-b-0 lg:border-r lg:p-5">
          <div className="mb-4 hidden items-center gap-2 px-3 text-xs font-bold tracking-[0.12em] text-slate-400 lg:flex"><Gavel className="size-4" />JUDGE PANEL</div>
          <nav aria-label="评审导航" className="flex gap-2 overflow-x-auto lg:grid">
            {judgeNavItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 min-w-max items-center gap-3 rounded-lg border px-3 text-sm font-semibold lg:min-w-0", active ? "border-swufe-red/20 bg-red-50 text-swufe-red" : "border-transparent text-slate-600 hover:bg-slate-100")}><Icon className="size-4" />{item.label}</Link>;
            })}
          </nav>
          <div className="mt-6 hidden rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-500 lg:block">仅显示已分配赛事及其结果。评分提交会记录评委、时间和聚合结果。</div>
        </aside>
        <main className="min-w-0 p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-[78rem] space-y-6">{children}</div></main>
      </div>
    </div>
  );
}
