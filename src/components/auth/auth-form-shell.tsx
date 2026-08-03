import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AuthFormShellProps = {
  badge: string;
  title: string;
  description: string;
  footerText: string;
  footerHref: string;
  footerLinkLabel: string;
  children: React.ReactNode;
};

export function AuthFormShell({
  badge,
  title,
  description,
  footerText,
  footerHref,
  footerLinkLabel,
  children,
}: AuthFormShellProps) {
  return (
    <Card className="surface-sheen motion-fade-up interactive-lift relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/72 shadow-[0_34px_90px_-48px_rgba(2,6,23,0.88)] backdrop-blur-xl">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.22),transparent_42%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_34%)]"
      />
      <CardHeader className="relative space-y-4 border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-100/80">
          {badge}
        </p>
        <div className="space-y-2">
          <CardTitle className="text-3xl tracking-tight text-white">
            {title}
          </CardTitle>
          <CardDescription className="text-base leading-7 text-slate-300">
            {description}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-6 p-8">
        {children}
        <div className="rounded-[1.25rem] border border-white/10 bg-white/6 px-4 py-3">
          <p className="text-sm leading-7 text-slate-300">
            {footerText}{" "}
            <Link
              href={footerHref}
              className="font-medium text-sky-200 underline-offset-4 hover:underline"
            >
              {footerLinkLabel}
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
