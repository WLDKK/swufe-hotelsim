"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { loginAction, type AuthFormState } from "@/app/(auth)/actions";
import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
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
            className="text-sm font-semibold text-swufe-red underline-offset-4 hover:underline"
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

    </AuthFormShell>
  );
}
