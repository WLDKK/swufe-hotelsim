"use client";

import { Compass, Coins, Megaphone, Sparkles, Wind } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  buildStudentRoundPlaybook,
  type StudentRoundEnvironmentInput,
} from "@/lib/student/playbook";
import { DECISION_PRESETS, type DecisionPreset } from "@/lib/decisions/presets";
import type { DecisionFormValues } from "@/lib/decisions/form";
import { cn } from "@/lib/utils";

type StudentRoundEnvironmentCardProps = {
  locale: "zh-CN" | "en-US";
  round: StudentRoundEnvironmentInput | null;
  hotelState: {
    cashBalance: number;
    totalDebt: number;
    brandReputation: number;
    guestSatisfaction: number;
    esgScore: number;
  } | null;
  values?: DecisionFormValues | null;
  activePresetId?: DecisionPreset["id"] | null;
  canApplyPreset?: boolean;
  isBusy?: boolean;
  onApplyPreset?: (preset: DecisionPreset) => void;
};

const actionIcons = {
  pricing: Sparkles,
  marketing: Megaphone,
  operations: Wind,
  finance: Coins,
} as const;

function getDemandToneClass(outlook: "strong" | "balanced" | "soft") {
  if (outlook === "strong") {
    return "border-sky-300/25 bg-sky-400/10 text-sky-100";
  }

  if (outlook === "soft") {
    return "border-rose-300/25 bg-rose-400/10 text-rose-100";
  }

  return "border-amber-300/25 bg-amber-400/10 text-amber-100";
}

function getAlignmentToneClass(
  status: "aligned" | "mixed" | "misaligned" | "pending"
) {
  switch (status) {
    case "aligned":
      return "border-emerald-300/30 bg-emerald-500/10 text-emerald-100";
    case "mixed":
      return "border-amber-300/30 bg-amber-500/10 text-amber-100";
    case "misaligned":
      return "border-rose-300/30 bg-rose-500/10 text-rose-100";
    default:
      return "border-slate-200/15 bg-white/8 text-slate-200";
  }
}

export function StudentRoundEnvironmentCard({
  locale,
  round,
  hotelState,
  values,
  activePresetId,
  canApplyPreset,
  isBusy,
  onApplyPreset,
}: StudentRoundEnvironmentCardProps) {
  if (!round) {
    return null;
  }

  const zh = locale === "zh-CN";
  const playbook = buildStudentRoundPlaybook({
    round,
    locale,
    hotelState,
    values,
  });
  const recommendedPreset =
    DECISION_PRESETS.find(
      (preset) => preset.id === playbook.recommendedPreset.presetId
    ) ?? null;

  return (
    <Card className="border-sky-400/20 bg-[linear-gradient(145deg,rgba(2,6,23,0.94),rgba(15,23,42,0.9))] text-slate-50 shadow-[0_34px_90px_-48px_rgba(14,165,233,0.36)]">
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border border-white/10 bg-white/10 text-slate-100">
            {zh ? "本轮市场情景卡" : "Round playbook"}
          </Badge>
          <Badge className={cn("rounded-full", getDemandToneClass(playbook.environment.demandOutlook))}>
            {playbook.environment.demandOutlook === "strong"
              ? zh
                ? "需求偏强"
                : "Demand up"
              : playbook.environment.demandOutlook === "soft"
                ? zh
                  ? "需求承压"
                  : "Demand soft"
                : zh
                  ? "需求均衡"
                  : "Demand balanced"}
          </Badge>
          <Badge className="border border-fuchsia-300/25 bg-fuchsia-400/10 text-fuchsia-100">
            {playbook.environment.monthLabel}
          </Badge>
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-3">
            <CardTitle className="text-2xl text-white">
              {zh
                ? `第 ${round.roundNumber} 轮环境节奏：${playbook.environment.seasonLabel}`
                : `Round ${round.roundNumber}: ${playbook.environment.seasonLabel}`}
            </CardTitle>
            <CardDescription className="text-slate-300">
              {playbook.headline}
            </CardDescription>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/6 p-4 text-sm leading-7 text-slate-200">
              {playbook.scenarioSummary}
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                playbook.environment.weatherLabel,
                playbook.environment.economyLabel,
                playbook.environment.eventLabel,
              ].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-slate-200"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-[1.5rem] border border-white/10 bg-white/6 p-5">
            <div className="flex items-center gap-2 text-sky-100">
              <Compass className="size-4" />
              <p className="text-sm font-semibold">
                {zh ? "系统建议打法" : "Recommended posture"}
              </p>
            </div>
            <p className="text-xl font-semibold text-white">
              {recommendedPreset
                ? zh
                  ? recommendedPreset.label.zh
                  : recommendedPreset.label.en
                : zh
                  ? "待推荐"
                  : "Recommendation pending"}
            </p>
            <p className="text-sm leading-7 text-slate-200">
              {playbook.recommendedPreset.reason}
            </p>
            <div
              className={cn(
                "rounded-[1.2rem] border px-4 py-3 text-sm",
                getAlignmentToneClass(playbook.alignment.status)
              )}
            >
              <p className="font-semibold">{playbook.alignment.title}</p>
              <p className="mt-1 leading-7 opacity-90">{playbook.alignment.detail}</p>
            </div>

            {recommendedPreset && onApplyPreset ? (
              <Button
                type="button"
                className="w-full"
                disabled={!canApplyPreset || isBusy || activePresetId === recommendedPreset.id}
                onClick={() => onApplyPreset(recommendedPreset)}
              >
                {activePresetId === recommendedPreset.id
                  ? zh
                    ? "当前已采用推荐打法"
                    : "Recommended preset active"
                  : zh
                    ? "一键套用推荐打法"
                    : "Apply recommended preset"}
              </Button>
            ) : null}

            <div className="rounded-[1.2rem] border border-white/10 bg-slate-950/35 p-4 text-xs leading-6 text-slate-300">
              <p>
                S {playbook.environment.seasonFactor.toFixed(3)} / E{" "}
                {playbook.environment.economyFactor.toFixed(3)} / X{" "}
                {playbook.environment.eventFactor.toFixed(3)}
              </p>
              <p className="mt-2">{playbook.environment.suggestionReason}</p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {playbook.actions.map((action) => {
          const Icon = actionIcons[action.id];

          return (
            <div
              key={action.id}
              className="rounded-[1.25rem] border border-white/10 bg-white/6 p-4"
            >
              <div className="flex items-center gap-2 text-slate-100">
                <Icon className="size-4" />
                <p className="text-sm font-semibold">{action.title}</p>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-300">{action.detail}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
