"use client";

import Link from "next/link";
import { Home, Menu, ShieldCheck } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { WorkspaceNav, type WorkspaceNavItem } from "@/components/layout/workspace-nav";
import { buttonVariants } from "@/components/ui/button";
import type { SupportedLocale } from "@/i18n/messages";
import { useLocale } from "@/i18n/use-locale";
import { cn } from "@/lib/utils";

type WorkspaceRole = "student" | "teacher" | "admin";

type WorkspaceShellProps = {
  role: WorkspaceRole;
  userName: string;
  userEmail: string;
  navItems: WorkspaceNavItem[];
  children: React.ReactNode;
};

const labels: Record<SupportedLocale, {
  roles: Record<WorkspaceRole, string>;
  roleTitles: Record<WorkspaceRole, string>;
  nav: Record<string, string>;
  back: string;
  signOut: string;
  navigation: string;
}> = {
  "zh-CN": {
    roles: { student: "参赛团队", teacher: "教学运营", admin: "赛事管理" },
    roleTitles: { student: "经营决策工作台", teacher: "课程与模拟控制台", admin: "平台与赛事控制台" },
    nav: {
      "/student/dashboard": "总览", "/student/team": "团队", "/student/decisions": "经营决策", "/student/results": "经营结果", "/student/rankings": "排名", "/student/join": "加入班级",
      "/teacher/dashboard": "总览", "/teacher/semesters": "学期", "/teacher/classes": "班级", "/teacher/simulation": "模拟运行", "/teacher/grading": "评分",
      "/admin/dashboard": "总览", "/admin/competitions": "赛事运营", "/admin/users": "用户", "/admin/semesters": "学期", "/admin/classes": "班级",
    },
    back: "首页", signOut: "退出", navigation: "工作区导航",
  },
  "en-US": {
    roles: { student: "Competition team", teacher: "Teaching operations", admin: "Competition admin" },
    roleTitles: { student: "Management decision desk", teacher: "Course and simulation console", admin: "Platform and competition console" },
    nav: {
      "/student/dashboard": "Overview", "/student/team": "Team", "/student/decisions": "Decisions", "/student/results": "Results", "/student/rankings": "Rankings", "/student/join": "Join class",
      "/teacher/dashboard": "Overview", "/teacher/semesters": "Semesters", "/teacher/classes": "Classes", "/teacher/simulation": "Simulation", "/teacher/grading": "Grading",
      "/admin/dashboard": "Overview", "/admin/competitions": "Competition", "/admin/users": "Users", "/admin/semesters": "Semesters", "/admin/classes": "Classes",
    },
    back: "Home", signOut: "Sign out", navigation: "Workspace navigation",
  },
};

export function WorkspaceShell({ role, userName, userEmail, navItems, children }: WorkspaceShellProps) {
  const { locale } = useLocale();
  const copy = labels[locale];
  const localizedNav = navItems.map((item) => ({ ...item, label: copy.nav[item.href] ?? item.label }));

  return (
    <div className="min-h-screen bg-swufe-cream">
      <a href="#workspace-content" className="sr-only z-50 rounded-md bg-white px-4 py-3 text-swufe-red focus:not-sr-only focus:fixed focus:left-4 focus:top-4">跳到主要内容</a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 w-full max-w-[96rem] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="grid size-10 shrink-0 place-items-center rounded-lg bg-swufe-red text-xs font-bold text-white" aria-label="SWUFE HotelSim 首页">财</Link>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-swufe-blue">SWUFE HotelSim</p>
              <p className="truncate text-xs text-slate-500">{copy.roles[role]} · {copy.roleTitles[role]}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden text-right md:block">
              <p className="max-w-48 truncate text-sm font-semibold text-slate-800">{userName}</p>
              <p className="max-w-48 truncate text-xs text-slate-500">{userEmail}</p>
            </div>
            <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))} aria-label={copy.back}><Home className="size-4" /></Link>
            <SignOutButton className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50" label={copy.signOut} />
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[96rem] lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-white p-3 lg:min-h-[calc(100vh-4rem)] lg:border-b-0 lg:border-r lg:p-5">
          <div className="mb-3 hidden items-center gap-2 px-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-400 lg:flex"><Menu className="size-4" />{copy.navigation}</div>
          <WorkspaceNav
            items={localizedNav}
            activeClassName="border-swufe-red/20 bg-red-50 text-swufe-red"
            inactiveClassName="border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-swufe-blue"
          />
          <div className="mt-6 hidden rounded-lg border border-slate-200 bg-slate-50 p-4 lg:block">
            <ShieldCheck className="size-5 text-swufe-red" />
            <p className="mt-3 text-xs font-semibold text-slate-700">权限边界已启用</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">关键写入操作会校验角色、资源归属并记录审计日志。</p>
          </div>
        </aside>

        <main id="workspace-content" className="min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-[78rem] space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
