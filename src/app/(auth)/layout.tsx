import { GraduationCap, KeyRound, ShieldCheck, Workflow } from "lucide-react";
import { PUBLIC_DEMO_ACCOUNTS, PUBLIC_DEMO_PASSWORD } from "@/lib/demo-accounts";

const authHighlights = [
  {
    icon: Workflow,
    title: "统一入口",
    body: "教师、学生与管理员共用同一套认证入口，登录后会自动进入各自工作区。",
  },
  {
    icon: ShieldCheck,
    title: "安全校验",
    body: "支持邮箱验证、密码找回与验证码校验，便于正式上线后的账号管理。",
  },
  {
    icon: GraduationCap,
    title: "教学适配",
    body: "认证入口与后续实验流程保持一致，适合课堂演示、试运行与正式实验使用。",
  },
] as const;

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_14%_14%,rgba(56,189,248,0.16),transparent_20%),radial-gradient(circle_at_84%_18%,rgba(59,130,246,0.14),transparent_18%),radial-gradient(circle_at_78%_86%,rgba(245,158,11,0.08),transparent_22%),linear-gradient(135deg,#050b16_0%,#08111f_46%,#04070d_100%)]">
      <div
        aria-hidden
        className="motion-float pointer-events-none absolute left-[-8rem] top-10 size-72 rounded-full bg-sky-400/18 blur-3xl"
      />
      <div
        aria-hidden
        className="motion-float pointer-events-none absolute right-[-9rem] top-28 size-80 rounded-full bg-amber-300/16 blur-3xl"
        style={{ animationDelay: "1.4s" }}
      />
      <section className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-6 py-12 md:px-10 lg:py-16">
        <div className="grid w-full gap-10 lg:grid-cols-[1.06fr_0.94fr] lg:items-center">
          <div className="space-y-8 motion-fade-up">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-100/80">
              SWUFE HotelSim
            </p>

            <div className="surface-sheen overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(140deg,rgba(7,16,31,0.96),rgba(13,21,39,0.95))] p-8 text-white shadow-[0_32px_90px_-50px_rgba(2,6,23,0.88)] sm:p-10">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm text-slate-100">
                <KeyRound className="size-4" />
                <span>统一认证中心</span>
              </div>
              <div className="mt-6 space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  正式进入酒店经营模拟系统，从这里开始。
                </h1>
                <p className="max-w-2xl text-base leading-8 text-slate-200 sm:text-lg">
                  当前认证区面向课程实验、课堂演示与正式运行场景设计，统一承接登录、注册、邮箱验证与密码找回等常见操作。
                </p>
                <p className="max-w-2xl rounded-[1.5rem] border border-white/10 bg-white/6 px-5 py-4 text-sm leading-7 text-slate-200">
                  登录成功后，系统会根据账号角色自动进入学生、教师或管理工作区，并沿用同一套会话与权限体系。
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3 content-auto">
              {authHighlights.map((item, index) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="interactive-lift motion-fade-up rounded-[1.5rem] border border-white/10 bg-slate-950/55 p-5 shadow-[0_24px_56px_-38px_rgba(2,6,23,0.82)]"
                    style={{ animationDelay: `${120 + index * 90}ms` }}
                  >
                    <div className="flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/8 text-sky-100">
                      <Icon className="size-5" />
                    </div>
                    <p className="mt-4 text-base font-semibold text-white">
                      {item.title}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-300">{item.body}</p>
                  </div>
                );
              })}
            </div>

            <div className="motion-fade-up rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-6 shadow-[0_24px_56px_-38px_rgba(2,6,23,0.82)] motion-fade-delay-2">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                体验账号
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {PUBLIC_DEMO_ACCOUNTS.map((account, index) => (
                  <div
                    key={account.email}
                    className="interactive-lift rounded-2xl border border-white/10 bg-white/6 p-4"
                    style={{ animationDelay: `${240 + index * 70}ms` }}
                  >
                    <p className="text-sm font-medium text-white">{account.label}</p>
                    <p className="mt-2 text-sm text-slate-300">{account.email}</p>
                    <p className="mt-2 text-xs leading-6 text-slate-400">{account.hint}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-4 py-3">
                {PUBLIC_DEMO_PASSWORD ? (
                  <p className="text-sm font-medium text-sky-100">
                    统一体验密码：{PUBLIC_DEMO_PASSWORD}
                  </p>
                ) : (
                  <p className="text-sm font-medium text-sky-100">
                    当前部署未启用公开体验密码。
                  </p>
                )}
                <p className="mt-1 text-sm leading-7 text-slate-300">
                  公开页面仅展示教师、评委与学生体验账号。最高权限管理员账号仍保留，但建议只由维护人单独持有并按需提供。
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center lg:justify-end motion-fade-up motion-fade-delay-1">
            <div className="w-full max-w-xl">{children}</div>
          </div>
        </div>
      </section>
    </main>
  );
}
