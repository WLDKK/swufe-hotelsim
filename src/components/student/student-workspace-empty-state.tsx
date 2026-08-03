"use client";

import Link from "next/link";
import { Compass, Users } from "lucide-react";
import { useLocale } from "@/i18n/use-locale";
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

export type StudentWorkspaceSection =
  | "dashboard"
  | "team"
  | "decisions"
  | "results"
  | "rankings";

type StudentWorkspaceEmptyStateProps = {
  section: StudentWorkspaceSection;
};

export function StudentWorkspaceEmptyState({
  section,
}: StudentWorkspaceEmptyStateProps) {
  const { messages } = useLocale();
  const copy = messages.studentEmptyState;
  const sectionCopy = copy.sections[section];

  return (
    <Card className="overflow-hidden border-amber-400/15 bg-[linear-gradient(135deg,rgba(10,16,29,0.94),rgba(23,12,17,0.94))] shadow-[0_34px_90px_-50px_rgba(245,158,11,0.45)]">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="border-amber-400/20 bg-amber-300/10 text-amber-100 hover:bg-amber-300/10">
            {sectionCopy.badgeLabel}
          </Badge>
          <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-amber-100">
            {copy.statusBadge}
          </span>
        </div>
        <div className="space-y-2">
          <CardTitle className="text-3xl tracking-tight text-white">
            {copy.title}
          </CardTitle>
          <CardDescription className="max-w-2xl text-base leading-7 text-slate-300">
            {sectionCopy.description}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-300/10 text-amber-100">
              <Users aria-hidden="true" className="size-5" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                {copy.missingTitle}
              </p>
              <p className="text-sm leading-7 text-slate-300">{sectionCopy.detail}</p>
            </div>
          </div>
        </div>

        {/* Keep the student empty-state actions lightweight and local. The user
            cannot fix team assignment alone, but they can still verify that the
            authenticated dashboard shell is healthy while waiting for setup. */}
        <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-300/10 text-amber-100">
              <Compass aria-hidden="true" className="size-5" />
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                {copy.nextChecksTitle}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/student/dashboard"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "border-white/10 bg-white/6 text-slate-100 hover:border-amber-400/25 hover:bg-white/10"
                  )}
                >
                  {copy.actions.dashboard}
                </Link>
                <Link
                  href="/student/decisions"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "border-white/10 bg-white/6 text-slate-100 hover:border-amber-400/25 hover:bg-white/10"
                  )}
                >
                  {copy.actions.decisions}
                </Link>
                <Link
                  href="/student/join"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "border-white/10 bg-white/6 text-slate-100 hover:border-amber-400/25 hover:bg-white/10"
                  )}
                >
                  {copy.actions.join}
                </Link>
              </div>
              <p className="text-sm leading-7 text-slate-300">
                {copy.closingNote}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
