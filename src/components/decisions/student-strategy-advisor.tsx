"use client";

import { AlertTriangle, Sparkles, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type DecisionFormValues } from "@/lib/decisions/form";
import { cn } from "@/lib/utils";
import { analyzeDecisionStrategy } from "@/lib/simulation/strategy-insights";

type StudentStrategyAdvisorProps = {
  values: DecisionFormValues;
  locale: "zh-CN" | "en-US";
  hotelState: {
    cashBalance: number;
    totalDebt: number;
    brandReputation: number;
    guestSatisfaction: number;
    esgScore: number;
  } | null;
};

function getSignalAccent(score: number) {
  if (score >= 78) {
    return "bg-emerald-400";
  }

  if (score >= 56) {
    return "bg-sky-400";
  }

  if (score >= 36) {
    return "bg-amber-400";
  }

  return "bg-rose-400";
}

function getWarningTone(severity: "high" | "medium" | "low") {
  if (severity === "high") {
    return "border-rose-300/40 bg-rose-500/10 text-rose-100";
  }

  if (severity === "medium") {
    return "border-amber-300/40 bg-amber-500/10 text-amber-100";
  }

  return "border-sky-300/30 bg-sky-500/10 text-sky-100";
}

export function StudentStrategyAdvisor({
  values,
  locale,
  hotelState,
}: StudentStrategyAdvisorProps) {
  const zh = locale === "zh-CN";
  const snapshot = analyzeDecisionStrategy({
    values,
    locale,
    hotelState,
  });

  return (
    <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <Card className="border-sky-400/20 bg-[linear-gradient(145deg,rgba(2,6,23,0.92),rgba(15,23,42,0.88))] text-slate-50 shadow-[0_28px_80px_-42px_rgba(14,165,233,0.35)]">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border border-sky-300/30 bg-sky-400/10 text-sky-100">
              {zh ? "策略顾问" : "Strategy advisor"}
            </Badge>
            <Badge className="border border-white/10 bg-white/10 text-slate-100">
              {snapshot.readinessLabel}
            </Badge>
          </div>
          <CardTitle className="text-2xl text-white">
            {snapshot.archetype.label}
          </CardTitle>
          <CardDescription className="text-slate-300">
            {snapshot.archetype.summary}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-[1.3rem] border border-white/10 bg-white/6 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-300">
                  {zh ? "提交准备度" : "Submission readiness"}
                </p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {snapshot.readinessScore}
                </p>
              </div>
              <div className="h-16 w-16 rounded-full border border-white/10 bg-white/8 p-1">
                <div className="flex h-full items-center justify-center rounded-full bg-[conic-gradient(from_180deg_at_50%_50%,rgba(14,165,233,0.24),rgba(56,189,248,0.88),rgba(34,197,94,0.8),rgba(14,165,233,0.24))] text-sm font-semibold text-slate-950">
                  {snapshot.readinessScore}
                </div>
              </div>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-200">
              {snapshot.headline}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {snapshot.signals.map((signal) => (
              <div
                key={signal.id}
                className="rounded-[1.2rem] border border-white/10 bg-white/6 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">{signal.label}</p>
                  <span className="text-sm font-semibold text-slate-100">
                    {signal.score}
                  </span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/10">
                  <div
                    className={cn("h-full rounded-full transition-all", getSignalAccent(signal.score))}
                    style={{ width: `${signal.score}%` }}
                  />
                </div>
                <p className="mt-3 text-xs leading-6 text-slate-300">
                  {signal.detail}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card className="border-border/70 bg-background/95 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="size-4 text-sky-500" />
              <CardTitle className="text-xl">
                {zh ? "当前主攻客群" : "Primary focus segments"}
              </CardTitle>
            </div>
            <CardDescription>
              {zh
                ? "按营销分配看，你当前最强调的客群会优先定义这轮打法。"
                : "These are the segments your current marketing mix emphasizes most."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {snapshot.focusSegments.map((segment) => (
              <Badge
                key={segment.id}
                variant="outline"
                className="rounded-full border-sky-200/50 bg-sky-50/70 px-3 py-1 text-sky-900"
              >
                {segment.label} {segment.allocation.toFixed(1)}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-background/95 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              <CardTitle className="text-xl">
                {zh ? "需要留意的风险" : "Watchlist"}
              </CardTitle>
            </div>
            <CardDescription>
              {zh
                ? "这些不是绝对错误，而是最可能拖累你这一轮执行效果的地方。"
                : "These are the issues most likely to weaken execution this round."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.warnings.length > 0 ? (
              snapshot.warnings.map((warning) => (
                <div
                  key={warning.id}
                  className={cn(
                    "rounded-[1.15rem] border px-4 py-3",
                    getWarningTone(warning.severity)
                  )}
                >
                  <p className="text-sm font-semibold">{warning.title}</p>
                  <p className="mt-1 text-xs leading-6 opacity-90">
                    {warning.detail}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.15rem] border border-emerald-300/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {zh
                  ? "当前这版策略结构比较顺，暂时没有明显的结构性警报。"
                  : "This draft looks structurally clean with no major warning flags."}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-background/95 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-fuchsia-500" />
              <CardTitle className="text-xl">
                {zh ? "下一步可优化动作" : "Next best moves"}
              </CardTitle>
            </div>
            <CardDescription>
              {zh
                ? "如果你还想再把这轮打得更漂亮，可以优先改这几件事。"
                : "If you want to sharpen the plan, start here."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="rounded-[1.15rem] border border-slate-200/70 bg-slate-50/80 px-4 py-3"
              >
                <p className="text-sm font-semibold text-slate-950">
                  {suggestion.title}
                </p>
                <p className="mt-1 text-xs leading-6 text-slate-600">
                  {suggestion.detail}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
