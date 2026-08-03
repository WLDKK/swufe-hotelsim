import Link from "next/link";
import {
  clearEmailVerificationTokensForUser,
  consumeEmailVerificationToken,
} from "@/lib/security/tokens";
import { markUserEmailVerified } from "@/lib/dal/users";
import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";

export const dynamic = "force-dynamic";

type VerifyEmailPageProps = {
  searchParams?: Promise<{
    token?: string;
    email?: string;
  }>;
};

async function verifyToken(token: string) {
  const result = await consumeEmailVerificationToken(token);

  if (result.status !== "valid") {
    return result.status;
  }

  await markUserEmailVerified(result.userId);
  await clearEmailVerificationTokensForUser(result.userId);

  return "success" as const;
}

export default async function VerifyEmailPage(props: VerifyEmailPageProps) {
  const searchParams = await props.searchParams;
  const verificationState = searchParams?.token
    ? await verifyToken(searchParams.token)
    : "idle";

  return (
    <AuthFormShell
      badge="邮箱验证"
      title="验证邮箱"
      description="如果当前环境启用了邮箱验证，学生需要先完成此步骤后才能正常登录。教师与管理员示例账号通常已完成初始化处理。"
      footerText="已经完成验证？"
      footerHref="/login"
      footerLinkLabel="返回登录"
    >
      {verificationState === "success" ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-sm text-foreground">
            邮箱验证成功，现在可以返回登录页继续使用系统。
          </div>
          <Link href="/login" className="font-medium text-primary hover:underline">
            前往登录
          </Link>
        </div>
      ) : verificationState === "invalid" ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            验证链接无效，请重新发送验证邮件。
          </div>
          <ResendVerificationForm defaultEmail={searchParams?.email} />
        </div>
      ) : verificationState === "expired" ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            验证链接已过期，请重新发送验证邮件。
          </div>
          <ResendVerificationForm defaultEmail={searchParams?.email} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-sm text-foreground">
            如果注册后没有自动进入系统，可以在这里重新发送验证邮件。
          </div>
          <ResendVerificationForm defaultEmail={searchParams?.email} />
        </div>
      )}
    </AuthFormShell>
  );
}
