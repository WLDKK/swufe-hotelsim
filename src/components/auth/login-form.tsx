"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { loginAction, type AuthFormState } from "@/app/(auth)/actions";
import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { PUBLIC_DEMO_ACCOUNTS, PUBLIC_DEMO_PASSWORD } from "@/lib/demo-accounts";
import { Input } from "@/components/ui/input";

type LoginFormProps = {
  callbackUrl?: string;
};

const initialState: AuthFormState = {
  message: "",
  fieldErrors: {},
};

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const [state, formAction] = useFormState(loginAction, initialState);

  return (
    <AuthFormShell
      badge="统一认证"
      title="登录酒店经营模拟系统"
      description="使用已分配账号进入系统。教师、学生与管理员登录后会自动跳转到对应工作区。"
      footerText="还没有学生账号？"
      footerHref="/register"
      footerLinkLabel="立即注册"
    >
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            邮箱
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="teacher@hotelsim.example"
            autoComplete="email"
            required
          />
          {state.fieldErrors.email ? (
            <p className="text-sm text-destructive">{state.fieldErrors.email}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              密码
            </label>
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-sky-200 underline-offset-4 hover:underline"
            >
              忘记密码
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="请输入密码"
            autoComplete="current-password"
            required
          />
          {state.fieldErrors.password ? (
            <p className="text-sm text-destructive">{state.fieldErrors.password}</p>
          ) : null}
        </div>

        {state.message ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {state.message}
          </div>
        ) : null}

        <AuthSubmitButton idleLabel="登录" pendingLabel="登录中..." />
      </form>

      <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-5 text-sm text-slate-300">
        <p className="font-medium text-white">体验账号说明</p>
        <p className="mt-2 leading-7">
          当前演示环境已清空旧注册与旧操作记录，下列账号可直接登录体验。
        </p>
        <div className="mt-3 space-y-2">
          {PUBLIC_DEMO_ACCOUNTS.map((account) => (
            <div
              key={account.email}
              className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3"
            >
              <p className="font-medium text-white">
                {account.label}：{account.email}
              </p>
              <p className="mt-1 text-xs leading-6 text-slate-400">{account.hint}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-4 py-3 text-sky-100">
          {PUBLIC_DEMO_PASSWORD ? (
            <p className="font-medium">统一体验密码：{PUBLIC_DEMO_PASSWORD}</p>
          ) : (
            <p className="font-medium">当前部署未启用公开体验密码。</p>
          )}
          <p className="mt-1 text-xs leading-6 text-sky-100/80">
            最高权限管理员账号仍保留，但不在页面公开显示；如需后台操作，可由当前维护人单独提供。
          </p>
        </div>
      </div>
    </AuthFormShell>
  );
}
