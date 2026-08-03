"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { hashPassword } from "@/lib/auth/passwords";
import { getDefaultDashboardPath, sanitizeCallbackUrl } from "@/lib/auth/routing";
import { signIn } from "@/lib/auth";
import { revalidateUserReadModels } from "@/lib/cache-invalidation";
import {
  createStudentCredentialUser,
  getUserByStudentId,
  getUserForCredentials,
  updateUserPasswordHash,
} from "@/lib/dal/users";
import { verifyCaptchaToken } from "@/lib/security/captcha";
import {
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
} from "@/lib/security/email";
import { getSecurityConfig } from "@/lib/security/config";
import {
  clearPasswordResetTokensForUser,
  consumePasswordResetToken,
  issueEmailVerificationToken,
  issuePasswordResetToken,
} from "@/lib/security/tokens";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";

export type AuthFormState = {
  message: string;
  fieldErrors: Record<string, string>;
};

function buildFieldErrors(
  fieldErrors: Record<string, string[] | undefined>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fieldErrors).flatMap(([key, value]) =>
      value?.[0] ? [[key, value[0]]] : []
    )
  );
}

function buildFormState(
  message: string,
  fieldErrors: Record<string, string> = {}
): AuthFormState {
  return {
    message,
    fieldErrors,
  };
}

async function validateCaptchaIfNeeded(formData: FormData) {
  const result = await verifyCaptchaToken(
    String(formData.get("captchaToken") ?? "") || null
  );

  if (result.success) {
    return null;
  }

  return buildFormState("请先完成人机验证后再提交。", {
    captchaToken: "请先完成人机验证。",
  });
}

export async function loginAction(
  _previousState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return buildFormState(
      "请先修正表单中的错误。",
      buildFieldErrors(parsed.error.flatten().fieldErrors)
    );
  }

  const callbackUrl = sanitizeCallbackUrl(String(formData.get("callbackUrl") ?? ""));
  const user = await getUserForCredentials(parsed.data.email);

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (getSecurityConfig().requireEmailVerification && user && !user.emailVerified) {
        return buildFormState("账号已创建，但请先完成邮箱验证后再登录。");
      }

      return buildFormState("邮箱或密码不正确。");
    }

    throw error;
  }

  redirect(callbackUrl ?? getDefaultDashboardPath(user?.role));
}

export async function registerAction(
  _previousState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    studentId: formData.get("studentId"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return buildFormState(
      "请先修正表单中的错误。",
      buildFieldErrors(parsed.error.flatten().fieldErrors)
    );
  }

  const captchaFailure = await validateCaptchaIfNeeded(formData);
  if (captchaFailure) {
    return captchaFailure;
  }

  const existingUser = await getUserForCredentials(parsed.data.email);
  if (existingUser) {
    return buildFormState("该邮箱已注册，请直接登录。", {
      email: "该邮箱已被使用。",
    });
  }

  if (parsed.data.studentId) {
    const existingStudentId = await getUserByStudentId(parsed.data.studentId);
    if (existingStudentId) {
      return buildFormState("该学号已被使用。", {
        studentId: "该学号已被使用。",
      });
    }
  }

  const config = getSecurityConfig();
  const passwordHash = await hashPassword(parsed.data.password);

  const user = await createStudentCredentialUser({
    name: parsed.data.name,
    email: parsed.data.email,
    studentId: parsed.data.studentId,
    passwordHash,
    emailVerified: config.requireEmailVerification ? null : new Date(),
  });

  revalidateUserReadModels([user.id]);

  if (config.requireEmailVerification) {
    const verificationToken = await issueEmailVerificationToken(user.id, user.email);
    await sendEmailVerificationEmail({
      to: user.email,
      rawToken: verificationToken.rawToken,
    });

    redirect(`/verify-email?email=${encodeURIComponent(user.email)}`);
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return buildFormState("账号已创建，但自动登录失败。请前往登录页重新登录。");
    }

    throw error;
  }

  redirect(getDefaultDashboardPath("STUDENT"));
}

export async function requestPasswordResetAction(
  _previousState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return buildFormState(
      "请先修正表单中的错误。",
      buildFieldErrors(parsed.error.flatten().fieldErrors)
    );
  }

  const captchaFailure = await validateCaptchaIfNeeded(formData);
  if (captchaFailure) {
    return captchaFailure;
  }

  const user = await getUserForCredentials(parsed.data.email);
  if (user?.passwordHash) {
    const resetToken = await issuePasswordResetToken(user.id, user.email);
    await sendPasswordResetEmail({
      to: user.email,
      rawToken: resetToken.rawToken,
    });
  }

  return buildFormState("如果该邮箱存在账号，重置链接已经发送。");
}

export async function resetPasswordAction(
  _previousState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return buildFormState(
      "请先修正表单中的错误。",
      buildFieldErrors(parsed.error.flatten().fieldErrors)
    );
  }

  const tokenResult = await consumePasswordResetToken(parsed.data.token);
  if (tokenResult.status !== "valid") {
    return buildFormState(
      tokenResult.status === "expired"
        ? "重置链接已过期，请重新申请。"
        : "重置链接无效，请重新申请。"
    );
  }

  const { userId } = tokenResult;
  const passwordHash = await hashPassword(parsed.data.password);
  await updateUserPasswordHash(userId, passwordHash);
  await clearPasswordResetTokensForUser(userId);
  revalidateUserReadModels([userId]);

  return buildFormState("密码已重置，现在可以使用新密码登录。");
}

export async function resendVerificationAction(
  _previousState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = resendVerificationSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return buildFormState(
      "请先修正表单中的错误。",
      buildFieldErrors(parsed.error.flatten().fieldErrors)
    );
  }

  const captchaFailure = await validateCaptchaIfNeeded(formData);
  if (captchaFailure) {
    return captchaFailure;
  }

  const user = await getUserForCredentials(parsed.data.email);
  if (user && !user.emailVerified) {
    const verificationToken = await issueEmailVerificationToken(user.id, user.email);
    await sendEmailVerificationEmail({
      to: user.email,
      rawToken: verificationToken.rawToken,
    });
  }

  return buildFormState("如果该邮箱仍未验证，新的验证链接已经发送。");
}
