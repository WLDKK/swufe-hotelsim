"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gavel, Home, LayoutDashboard, PenSquare, Trophy } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const judgeNavItems = [
  {
    href: "/judge/dashboard",
    label: "裁判总览",
    icon: LayoutDashboard,
  },
  {
    href: "/judge/scoring",
    label: "裁判评分",
    icon: PenSquare,
  },
] as const;

type JudgeShellProps = {
  userName: string;
  userEmail: string;
  children: React.ReactNode;
};

export function JudgeShell({ userName, userEmail, children }: JudgeShellProps) {
  const pathname = usePathname();

  return (
    <section className="mx-auto grid w-full max-w-[92rem] gap-6 px-4 py-4 sm:px-6 sm:py-6 xl:grid-cols-[18rem_minmax(0,1fr)] xl:px-8 2xl:px-10">
      <aside className="self-start xl:sticky xl:top-4">
        <div className="overflow-hidden rounded-[2rem] border border-sky-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(239,246,255,0.98))] shadow-[0_24px_80px_-44px_rgba(15,23,42,0.22)]">
          <div className="space-y-6 p-6">
            <div className="space-y-4">
              <Badge className="w-fit rounded-full border border-sky-200 bg-sky-50 text-sky-900">
                裁判工作区
              </Badge>
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-[1rem] border border-sky-200 bg-white text-sky-700 shadow-sm">
                  <Gavel className="size-6" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-500">SWUFE HotelSim</p>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                    比赛裁判台
                  </h1>
                  <p className="text-sm leading-7 text-slate-600">
                    保留原教师链路不动，同时把比赛评分独立到裁判工作区，便于后续正式比赛扩展。
                  </p>
                </div>
              </div>
            </div>

            <nav aria-label="Judge navigation" className="grid gap-2">
              {judgeNavItems.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition-all",
                      active
                        ? "border-sky-400/70 bg-sky-600 text-white shadow-[0_18px_36px_-24px_rgba(2,132,199,0.75)]"
                        : "border-sky-200/70 bg-white/85 text-slate-700 hover:border-sky-300 hover:bg-white"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="size-4" />
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>

            <div className="grid gap-3">
              <div className="rounded-[1.5rem] border border-sky-200/70 bg-white/85 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  当前账号
                </p>
                <p className="mt-2 text-base font-semibold text-slate-950">{userName}</p>
                <p className="mt-1 text-sm text-slate-600">{userEmail}</p>
              </div>
              <div className="rounded-[1.5rem] border border-sky-200/70 bg-white/85 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  核心目标
                </p>
                <p className="mt-2 text-base font-semibold text-slate-950">
                  评分独立、结果可解释
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  JudgeScore 作为新主链路落库，RoundResult 保留兼容字段，避免后续回调教师端时出现断层。
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="space-y-6">
        <header className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/88 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.25)] backdrop-blur">
          <div className="bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,255,255,0.72))] p-6">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="secondary" className="rounded-full px-3 py-1">
                    裁判工作流
                  </Badge>
                  <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                    Competition Ready
                  </span>
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                    裁判评分与展示入口
                  </h2>
                  <p className="max-w-3xl text-sm leading-7 text-slate-600">
                    当前先补齐比赛裁判总览与评分骨架，并与公开展示页共享同一套比赛基础数据。
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row xl:min-w-[11rem] xl:flex-col">
                <Link
                  href="/display"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "gap-2 border-slate-200 bg-white/88"
                  )}
                >
                  <Trophy className="size-4" />
                  公开展示页
                </Link>
                <Link
                  href="/"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "gap-2 border-slate-200 bg-white/88"
                  )}
                >
                  <Home className="size-4" />
                  返回首页
                </Link>
                <SignOutButton className="border-slate-200 bg-white/88" label="退出登录" />
              </div>
            </div>
          </div>
        </header>

        <div className="space-y-6 pb-4">{children}</div>
      </div>
    </section>
  );
}
