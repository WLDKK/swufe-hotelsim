"use client";

import { useFormState } from "react-dom";
import {
  resendVerificationAction,
  type AuthFormState,
} from "@/app/(auth)/actions";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { Input } from "@/components/ui/input";

type ResendVerificationFormProps = {
  defaultEmail?: string;
};

const initialState: AuthFormState = {
  message: "",
  fieldErrors: {},
};

export function ResendVerificationForm({
  defaultEmail,
}: ResendVerificationFormProps) {
  const [state, formAction] = useFormState(
    resendVerificationAction,
    initialState
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-foreground">
          邮箱
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={defaultEmail}
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

      <AuthSubmitButton idleLabel="重新发送验证邮件" pendingLabel="发送中..." />
    </form>
  );
}
