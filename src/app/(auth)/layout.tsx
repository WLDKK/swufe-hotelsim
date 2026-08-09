import Link from "next/link";
import { ArrowLeft, CheckCircle2, LockKeyhole } from "lucide-react";
import { PUBLIC_DEMO_ACCOUNTS, PUBLIC_DEMO_PASSWORD } from "@/lib/demo-accounts";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="min-h-screen bg-swufe-cream">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="order-2 border-t border-slate-200 bg-swufe-blue px-6 py-10 text-white sm:px-10 lg:order-1 lg:border-r lg:border-t-0 lg:px-12 lg:py-16">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-200 hover:text-white"><ArrowLeft className="size-4" />返回首页</Link>
          <div className="mt-12 max-w-lg">
            <span className="grid size-12 place-items-center rounded-lg bg-swufe-red font-bold">财</span>
            <p className="mt-6 text-sm font-bold tracking-[0.14em] text-swufe-gold">SWUFE HOTELSIM</p>
            <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">登录后继续你的赛事任务。</h1>
            <p className="mt-4 leading-7 text-slate-300">系统会根据账号角色进入参赛、教学、评审或管理工作区。权限校验覆盖页面、接口与具体赛事资源。</p>
          </div>

          <div className="mt-10 space-y-3 border-t border-white/15 pt-8 text-sm text-slate-300">
            {["邮箱验证与密码找回", "角色与资源双重授权", "关键操作审计记录"].map((item) => (
              <p key={item} className="flex items-center gap-3"><CheckCircle2 className="size-4 text-swufe-gold" />{item}</p>
            ))}
          </div>

          <details className="mt-10 rounded-lg border border-white/15 bg-white/5 p-4 text-sm">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold text-white"><LockKeyhole className="size-4 text-swufe-gold" />体验账号</summary>
            <div className="mt-3 space-y-3 text-slate-300">
              {PUBLIC_DEMO_ACCOUNTS.map((account) => <p key={account.email}><span className="font-semibold text-white">{account.label}</span><br />{account.email}</p>)}
              <p className="border-t border-white/10 pt-3">{PUBLIC_DEMO_PASSWORD ? `统一体验密码：${PUBLIC_DEMO_PASSWORD}` : "当前部署未开放体验密码。"}</p>
            </div>
          </details>
        </aside>

        <section className="order-1 flex items-center justify-center px-5 py-8 sm:px-10 sm:py-12 lg:order-2 lg:px-16">
          <div className="w-full max-w-lg">{children}</div>
        </section>
      </div>
    </main>
  );
}
