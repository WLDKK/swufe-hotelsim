import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AuthFormShellProps = {
  badge: string;
  title: string;
  description: string;
  footerText: string;
  footerHref: string;
  footerLinkLabel: string;
  children: React.ReactNode;
};

export function AuthFormShell({ badge, title, description, footerText, footerHref, footerLinkLabel, children }: AuthFormShellProps) {
  return (
    <Card className="border-slate-200 bg-white shadow-[0_24px_60px_-42px_rgba(27,58,92,0.35)]">
      <CardHeader className="space-y-4 border-b border-slate-100 p-6 sm:p-8">
        <p className="text-xs font-bold tracking-[0.14em] text-swufe-red">{badge}</p>
        <div className="space-y-2">
          <CardTitle className="text-2xl font-bold tracking-tight text-swufe-blue sm:text-3xl">{title}</CardTitle>
          <CardDescription className="leading-7 text-slate-600">{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-6 sm:p-8">
        {children}
        <p className="border-t border-slate-100 pt-5 text-sm text-slate-600">
          {footerText} <Link href={footerHref} className="font-semibold text-swufe-red hover:underline">{footerLinkLabel}</Link>
        </p>
      </CardContent>
    </Card>
  );
}
