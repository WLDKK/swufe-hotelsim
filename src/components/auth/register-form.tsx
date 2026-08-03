"use client";

import { useFormState } from "react-dom";
import { registerAction, type AuthFormState } from "@/app/(auth)/actions";
import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { Input } from "@/components/ui/input";

const initialState: AuthFormState = {
  message: "",
  fieldErrors: {},
};

export function RegisterForm() {
  const [state, formAction] = useFormState(registerAction, initialState);

  return (
    <AuthFormShell
      badge="学生注册"
      title="创建学生账号"
      description="学生可在此自助注册账号。注册完成后，可由教师或管理员将你加入对应班级和团队。"
      footerText="已经有账号？"
      footerHref="/login"
      footerLinkLabel="返回登录"
    >
      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium text-foreground">
            姓名
          </label>
          <Input
            id="name"
            name="name"
            placeholder="请输入姓名"
            autoComplete="name"
            required
          />
          {state.fieldErrors.name ? (
            <p className="text-sm text-destructive">{state.fieldErrors.name}</p>
          ) : null}
        </div>

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

        <div className="space-y-2">
          <label htmlFor="studentId" className="text-sm font-medium text-foreground">
            学号
          </label>
          <Input
            id="studentId"
            name="studentId"
            placeholder="选填，但建议填写"
            autoComplete="off"
          />
          {state.fieldErrors.studentId ? (
            <p className="text-sm text-destructive">{state.fieldErrors.studentId}</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              密码
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
              确认密码
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
        </div>

        <TurnstileWidget />
        {state.fieldErrors.captchaToken ? (
          <p className="text-sm text-destructive">{state.fieldErrors.captchaToken}</p>
        ) : null}

        {state.message ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {state.message}
          </div>
        ) : null}

        <AuthSubmitButton idleLabel="创建账号" pendingLabel="创建中..." />
      </form>

      <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-5 text-sm leading-7 text-slate-300">
        注册后如果启用了邮箱验证，系统会先发送验证邮件。完成验证后即可登录，再由教师或管理员完成班级与团队分配。
      </div>
    </AuthFormShell>
  );
}
