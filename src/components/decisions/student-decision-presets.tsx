"use client";

import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DECISION_PRESETS, type DecisionPreset } from "@/lib/decisions/presets";

type StudentDecisionPresetsProps = {
  locale: "zh-CN" | "en-US";
  canEdit: boolean;
  isBusy: boolean;
  activePresetId?: DecisionPreset["id"] | null;
  onApply: (preset: DecisionPreset) => void;
};

export function StudentDecisionPresets({
  locale,
  canEdit,
  isBusy,
  activePresetId,
  onApply,
}: StudentDecisionPresetsProps) {
  const zh = locale === "zh-CN";

  return (
    <Card className="border-border/70 bg-background/95 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Wand2 className="size-4 text-sky-500" />
          <CardTitle className="text-xl">
            {zh ? "一键打法模板" : "Strategy templates"}
          </CardTitle>
        </div>
        <CardDescription>
          {zh
            ? "不是代替你做决定，而是给出几种可直接试玩的经营姿态，帮助你快速比较不同打法的结果差异。"
            : "These presets provide playable operating postures you can compare quickly."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-2">
        {DECISION_PRESETS.map((preset) => {
          const isActive = activePresetId === preset.id;

          return (
            <div
              key={preset.id}
              className={cn(
                "rounded-[1.3rem] border p-4 transition",
                isActive
                  ? "border-sky-300/70 bg-sky-50/70 shadow-[0_20px_44px_-34px_rgba(14,165,233,0.35)]"
                  : "border-border/70 bg-muted/15"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {zh ? preset.label.zh : preset.label.en}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    {zh ? preset.summary.zh : preset.summary.en}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-full",
                    isActive
                      ? "border-sky-300/80 bg-sky-100 text-sky-900"
                      : "border-border/70"
                  )}
                >
                  {zh ? preset.posture.zh : preset.posture.en}
                </Badge>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1">
                  {zh ? "营销" : "Marketing"} {preset.values.marketingTotal}
                </span>
                <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1">
                  {zh ? "直连" : "Direct"} {preset.values.channelDirect}%
                </span>
                <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1">
                  OTA {preset.values.channelOTA}%
                </span>
                <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1">
                  {zh ? "技术投入" : "Tech"} {preset.values.capexTechnology ?? 0}
                </span>
              </div>

              <div className="mt-4">
                <Button
                  type="button"
                  variant={isActive ? "default" : "outline"}
                  disabled={!canEdit || isBusy}
                  onClick={() => onApply(preset)}
                >
                  {isActive
                    ? zh
                      ? "当前已套用"
                      : "Applied"
                    : zh
                      ? "套用这套打法"
                      : "Apply preset"}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
