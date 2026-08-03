"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { resetPasswordAction, type AuthFormState } from "@/app/(auth)/actions";
import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { Input } from "@/components/ui/input";

type ResetPasswordFormProps = {
  token: string;
};

const initialState: AuthFormState = {
  message: "",
  fieldErrors: {},
};

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [state, formAction] = useFormState(resetPasswordAction, initialState);

  return (
    <AuthFormShell
      badge="密码重置"
      title="设置新密码"
      description="输入新密码后，系统会立即更新当前账号凭证。重置成功后即可返回登录页重新进入系统。"
      footerText="需要重新申请重置链接？"
      footerHref="/forgot-password"
      footerLinkLabel="返回找回密码"
    >
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="token" value={token} />

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            新密码
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="至少 8 位"
            autoComplete="new-password"
            required
          />
          {state.fieldErrors.password ? (
            <p className="text-sm text-destructive">{state.fieldErrors.password}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="confirmPassword"
            className="text-sm font-medium text-foreground"
          >
            确认新密码
          </label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="再次输入密码"
            autoComplete="new-password"
            required
          />
          {state.fieldErrors.confirmPassword ? (
            <p className="text-sm text-destructive">
              {state.fieldErrors.confirmPassword}
            </p>
          ) : null}
        </div>

        {state.message ? (
          <div className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm text-foreground">
            {state.message}
            {state.message.includes("现在可以") ? (
              <>
                {" "}
                <Link href="/login" className="font-medium text-primary hover:underline">
                  前往登录
                </Link>
              </>
            ) : null}
          </div>
        ) : null}

        <AuthSubmitButton idleLabel="更新密码" pendingLabel="更新中..." />
      </form>
    </AuthFormShell>
  );
}
