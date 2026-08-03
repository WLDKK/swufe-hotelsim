"use client";

import { useFormState } from "react-dom";
import {
  requestPasswordResetAction,
  type AuthFormState,
} from "@/app/(auth)/actions";
import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { Input } from "@/components/ui/input";

const initialState: AuthFormState = {
  message: "",
  fieldErrors: {},
};

export function ForgotPasswordForm() {
  const [state, formAction] = useFormState(
    requestPasswordResetAction,
    initialState
  );

  return (
    <AuthFormShell
      badge="账号恢复"
      title="找回密码"
      description="输入注册邮箱后，系统会发送密码重置链接。为避免暴露账号状态，无论邮箱是否存在，页面都会返回统一提示。"
      footerText="已经想起密码了？"
      footerHref="/login"
      footerLinkLabel="返回登录"
    >
      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            邮箱
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="student@hotelsim.example"
            autoComplete="email"
            required
          />
          {state.fieldErrors.email ? (
            <p className="text-sm text-destructive">{state.fieldErrors.email}</p>
          ) : null}
        </div>

        <TurnstileWidget />
        {state.fieldErrors.captchaToken ? (
          <p className="text-sm text-destructive">{state.fieldErrors.captchaToken}</p>
        ) : null}

        {state.message ? (
          <div className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm text-foreground">
            {state.message}
          </div>
        ) : null}

        <AuthSubmitButton idleLabel="发送重置链接" pendingLabel="发送中..." />
      </form>
    </AuthFormShell>
  );
}
