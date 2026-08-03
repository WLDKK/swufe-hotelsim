import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type WorkspaceHeroSummaryItem = {
  label: string;
  value: string;
  hint: string;
};

export type WorkspaceHeroAction = {
  href: string;
  label: string;
  variant?: "default" | "outline";
};

type WorkspaceHeroTheme = {
  primaryCardClassName: string;
  badgeClassName: string;
  summaryCardClassName: string;
  secondaryCardClassName: string;
  actionClassName: string;
};

export type WorkspaceHeroProps = {
  badgeLabel: string;
  title: string;
  description: ReactNode;
  statusTitle: string;
  statusBody: string;
  summaryItems: WorkspaceHeroSummaryItem[];
  actions: WorkspaceHeroAction[];
  statusFooter?: ReactNode;
  theme: WorkspaceHeroTheme;
};

export function WorkspaceHero({
  badgeLabel,
  title,
  description,
  statusTitle,
  statusBody,
  summaryItems,
  actions,
  statusFooter,
  theme,
}: WorkspaceHeroProps) {
  return (
    <section className="content-auto grid gap-4 2xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
      <Card
        className={cn(
          "surface-sheen motion-fade-up interactive-lift overflow-hidden",
          theme.primaryCardClassName
        )}
        >
        <CardHeader className="space-y-4">
          <Badge className={cn("w-fit", theme.badgeClassName)}>{badgeLabel}</Badge>
          <div className="space-y-2">
            <CardTitle className="text-3xl tracking-tight text-white">
              {title}
            </CardTitle>
            <CardDescription className="max-w-3xl text-base leading-7 text-slate-300">
              {description}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {summaryItems.map((item) => (
            <div
              key={item.label}
              className={cn(
                "interactive-lift rounded-[1.5rem] border p-4",
                theme.summaryCardClassName
              )}
            >
              <p className="text-sm text-slate-400">{item.label}</p>
              <p className="mt-2 text-lg font-semibold text-white">{item.value}</p>
              <p className="mt-1 text-xs leading-6 text-slate-400">{item.hint}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card
        className={cn(
          "motion-fade-up motion-fade-delay-1 interactive-lift",
          theme.secondaryCardClassName
        )}
      >
        <CardHeader>
          <CardTitle className="text-xl text-white">{statusTitle}</CardTitle>
          <CardDescription className="leading-7 text-slate-300">
            {statusBody}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={cn(
                buttonVariants({
                  variant: action.variant ?? "outline",
                }),
                "interactive-lift justify-between",
                theme.actionClassName
              )}
            >
              {action.label}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          ))}
          {statusFooter}
        </CardContent>
      </Card>
    </section>
  );
}
