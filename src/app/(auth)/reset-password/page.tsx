import Link from "next/link";
import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

type ResetPasswordPageProps = {
  searchParams?: Promise<{
    token?: string;
  }>;
};

export default async function ResetPasswordPage(props: ResetPasswordPageProps) {
  const searchParams = await props.searchParams;
  if (!searchParams?.token) {
    return (
      <AuthFormShell
        badge="密码重置"
        title="缺少重置链接"
        description="当前页面没有接收到有效 token，请返回找回密码页面重新申请重置链接。"
        footerText="需要重新获取链接？"
        footerHref="/forgot-password"
        footerLinkLabel="重新申请"
      >
        <div className="rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-sm text-foreground">
          你也可以直接返回{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            登录页
          </Link>
          。
        </div>
      </AuthFormShell>
    );
  }

  return <ResetPasswordForm token={searchParams.token} />;
}
