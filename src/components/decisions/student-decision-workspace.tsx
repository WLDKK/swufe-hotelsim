"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Save, Send } from "lucide-react";
import { StudentDecisionPresets } from "@/components/decisions/student-decision-presets";
import { StudentStrategyAdvisor } from "@/components/decisions/student-strategy-advisor";
import { StudentRoundEnvironmentCard } from "@/components/student/student-round-environment-card";
import { StudentWorkspaceHero } from "@/components/student/student-workspace-hero";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { useLocale } from "@/i18n/use-locale";
import {
  getClassStatusLabel,
  getDecisionStatusLabel,
  getRoundStatusLabel,
} from "@/i18n/status-labels";
import {
  DECISION_FORM_FIELDS,
  DECISION_FORM_GROUPS,
  TAX_STRATEGY_OPTIONS,
  coerceDecisionFieldValue,
  mergeDecisionFormValues,
  type DecisionFormValues,
} from "@/lib/decisions/form";
import {
  applyDecisionPreset,
  DECISION_PRESETS,
  type DecisionPreset,
} from "@/lib/decisions/presets";
import {
  formatCompactCurrency,
  formatDate,
  formatNumber,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";

type StudentDecisionWorkspaceProps = {
  workspace: {
    team: {
      id: string;
      name: string;
      hotelName: string;
      color: string;
      hotelState: {
        cashBalance: number;
        totalDebt: number;
        brandReputation: number;
        guestSatisfaction: number;
        esgScore: number;
      } | null;
    };
    courseClass: {
      id: string;
      name: string;
      status: string;
      currentRound: number;
      maxRounds: number;
      semester: {
        id: string;
        name: string;
        code: string;
      };
    };
    round: {
      id: string;
      roundNumber: number;
      status: string;
      seasonFactor: number;
      economyFactor: number;
      eventFactor: number;
      eventDescription: string | null;
      randomSeed: string | null;
      deadline: string | null;
      processedAt: string | null;
    } | null;
  };
};

type DecisionRecord = DecisionFormValues & {
  id: string;
  teamId: string;
  roundId: string;
  status: string;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type DecisionResponse = {
  decision: DecisionRecord | null;
};

const selectClassName =
  "mt-2 flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function sumDecisionFields(
  values: DecisionFormValues,
  fields: Array<keyof DecisionFormValues>
) {
  return fields.reduce((total, field) => {
    const value = values[field];
    return typeof value === "number" ? total + value : total;
  }, 0);
}

export function StudentDecisionWorkspace({
  workspace,
}: StudentDecisionWorkspaceProps) {
  const { locale, messages } = useLocale();
  const copy = messages.studentDecisions;
  const formGroupLabels = copy.form.groupLabels as Record<
    string,
    { title: string; description: string }
  >;
  const fieldLabels = copy.form.fieldLabels as Record<keyof DecisionFormValues, string>;
  const taxOptionLabels = copy.form.taxOptions as Record<string, string>;
  const queryClient = useQueryClient();
  const [formValues, setFormValues] = useState<DecisionFormValues>(
    mergeDecisionFormValues()
  );
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");

  const decisionQuery = useQuery({
    queryKey: ["student-decision", workspace.team.id, workspace.round?.id],
    queryFn: () =>
      apiFetch<DecisionResponse>(
        `/api/decisions?teamId=${workspace.team.id}&roundId=${workspace.round?.id}`
      ),
    enabled: Boolean(workspace.round?.id),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!workspace.round?.id) {
      setFormValues(mergeDecisionFormValues());
      return;
    }

    // Rehydrate the form from the canonical API payload whenever the selected
    // round changes or a save/submit refetch finishes.
    setFormValues(mergeDecisionFormValues(decisionQuery.data?.decision ?? undefined));
  }, [decisionQuery.data?.decision, workspace.round?.id]);

  const mutation = useMutation({
    mutationFn: (mode: "draft" | "submit") =>
      apiFetch<DecisionResponse>("/api/decisions", {
        method: "POST",
        body: JSON.stringify({
          teamId: workspace.team.id,
          roundId: workspace.round?.id,
          mode,
          ...Object.fromEntries(
            DECISION_FORM_FIELDS.map((field) => [field, formValues[field]])
          ),
        }),
      }),
    onSuccess: async (data, mode) => {
      setFeedbackTone("success");
      setFeedbackMessage(
        mode === "draft"
          ? copy.saveDraftSuccess
          : copy.submitSuccess
      );

      await queryClient.invalidateQueries({
        queryKey: ["student-decision", workspace.team.id, workspace.round?.id],
      });

      if (data.decision) {
        setFormValues(mergeDecisionFormValues(data.decision));
      }
    },
    onError: (error) => {
      setFeedbackTone("error");
      setFeedbackMessage(
        error instanceof ApiClientError
          ? error.message
          : copy.genericMutationError
      );
    },
  });

  const currentDecision = decisionQuery.data?.decision ?? null;
  const canEdit = workspace.round?.status === "PENDING";
  const isRoundReady = Boolean(workspace.round?.id);
  const classStatusLabel = getClassStatusLabel(locale, workspace.courseClass.status);
  const roundStatusLabel = getRoundStatusLabel(locale, workspace.round?.status);
  const decisionStatusLabel = getDecisionStatusLabel(
    locale,
    currentDecision?.status ?? "NOT_STARTED"
  );

  const marketingSegmentTotal = sumDecisionFields(formValues, [
    "mktBudgetBusinessTransient",
    "mktBudgetBusinessGroup",
    "mktBudgetLeisureTransient",
    "mktBudgetLeisureGroup",
    "mktBudgetGovernment",
    "mktBudgetOnlineOTA",
    "mktBudgetAirlineCrew",
    "mktBudgetLongStay",
  ]);
  const channelMixTotal = sumDecisionFields(formValues, [
    "channelDirect",
    "channelOTA",
    "channelTravelAgent",
    "channelCorporate",
    "channelGDS",
  ]);
  const totalOpex = sumDecisionFields(formValues, [
    "opexRoomsMaintenance",
    "opexFoodBeverage",
    "opexFrontDesk",
    "opexHousekeeping",
    "opexUtilities",
    "opexStaffTraining",
    "opexStaffWelfare",
    "opexSecurity",
    "opexIT",
  ]);
  const totalCapex = sumDecisionFields(formValues, [
    "capexRenovation",
    "capexFurniture",
    "capexTechnology",
    "capexFacilities",
    "capexESGGreen",
  ]);
  const activePresetId =
    DECISION_PRESETS.find((preset) =>
      Object.entries(preset.values).every(
        ([key, value]) =>
          formValues[key as keyof DecisionFormValues] === value
      )
    )?.id ?? null;

  const updateField = (field: keyof DecisionFormValues, rawValue: string) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: coerceDecisionFieldValue(field, rawValue),
    }));
  };

  const persistDecision = (mode: "draft" | "submit") => {
    if (!workspace.round?.id || !canEdit || mutation.isPending) {
      return;
    }

    mutation.mutate(mode);
  };

  const handleApplyPreset = (preset: DecisionPreset) => {
    if (!canEdit || mutation.isPending || decisionQuery.isLoading) {
      return;
    }

    setFormValues((currentValues) => applyDecisionPreset(currentValues, preset));
    setFeedbackTone("success");
    setFeedbackMessage(
      locale === "zh-CN"
        ? `已套用“${preset.label.zh}”模板，你可以继续微调后再保存。`
        : `Applied the "${preset.label.en}" template. You can still fine-tune it before saving.`
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <StudentWorkspaceHero
        badgeLabel={copy.badgeLabel}
        title={`${copy.titlePrefix} ${workspace.team.name}`}
        description={
          <>
            {copy.description}
          </>
        }
        statusTitle={copy.statusTitle}
        statusBody={
          canEdit
            ? copy.editableStatus
            : workspace.round
              ? `${copy.reviewStatusPrefix} ${workspace.round.roundNumber} ${copy.reviewStatusMiddle} ${roundStatusLabel}, ${copy.reviewStatusSuffix}`
              : copy.waitingStatus
        }
        summaryItems={[
          {
            label: copy.classLabel,
            value: workspace.courseClass.name,
            hint: `${workspace.courseClass.semester.name} (${workspace.courseClass.semester.code})`,
          },
          {
            label: copy.roundLabel,
            value: workspace.round
              ? `${workspace.round.roundNumber} / ${workspace.courseClass.maxRounds}`
              : `0 / ${workspace.courseClass.maxRounds}`,
            hint: workspace.round
              ? `${roundStatusLabel} | ${copy.deadlineLabel} ${formatDate(workspace.round.deadline)}`
              : copy.waitingFirstRound,
          },
          {
            label: copy.decisionStatusLabel,
            value: decisionStatusLabel,
            hint: `${copy.updatedPrefix} ${formatDate(currentDecision?.updatedAt ?? null)}`,
          },
          {
            label: copy.hotelLabel,
            value: workspace.team.hotelName,
            hint: `${copy.hotelHintPrefix} ${classStatusLabel}`,
          },
        ]}
        actions={[
          { href: "/student/dashboard", label: copy.actions.dashboard, variant: "default" },
          { href: "/student/results", label: copy.actions.results },
          { href: "/student/rankings", label: copy.actions.rankings },
        ]}
      />

      <Card className="border-border/70 bg-background/95 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">{copy.currentHotelStateTitle}</CardTitle>
          <CardDescription>
            {copy.currentHotelStateDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">{copy.cashLabel}</p>
            <p className="mt-2 text-xl font-semibold">
              {formatCompactCurrency(workspace.team.hotelState?.cashBalance)}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">{copy.debtLabel}</p>
            <p className="mt-2 text-xl font-semibold">
              {formatCompactCurrency(workspace.team.hotelState?.totalDebt)}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">{copy.brandLabel}</p>
            <p className="mt-2 text-xl font-semibold">
              {formatNumber(workspace.team.hotelState?.brandReputation)}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">{copy.guestSatisfactionLabel}</p>
            <p className="mt-2 text-xl font-semibold">
              {formatNumber(workspace.team.hotelState?.guestSatisfaction)}
            </p>
          </div>
        </CardContent>
      </Card>

      <StudentRoundEnvironmentCard
        locale={locale === "zh-CN" ? "zh-CN" : "en-US"}
        round={workspace.round}
        hotelState={workspace.team.hotelState}
        values={formValues}
        activePresetId={activePresetId}
        canApplyPreset={Boolean(canEdit)}
        isBusy={mutation.isPending || decisionQuery.isLoading}
        onApplyPreset={handleApplyPreset}
      />

      {!isRoundReady ? (
        <Card className="border-border/70 bg-background/95 shadow-sm">
          <CardContent className="flex items-start gap-3 p-6 text-sm text-muted-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {copy.noRoundWarning}
          </CardContent>
        </Card>
      ) : null}

      {decisionQuery.isLoading ? (
        <Card className="border-border/70 bg-background/95 shadow-sm">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {copy.loadingCard}
          </CardContent>
        </Card>
      ) : null}

      {decisionQuery.error ? (
        <Card className="border-destructive/40 bg-background/95 shadow-sm">
          <CardContent className="p-6 text-sm text-destructive">
            {decisionQuery.error instanceof ApiClientError
              ? decisionQuery.error.message
              : copy.genericLoadError}
          </CardContent>
        </Card>
      ) : null}

      {feedbackMessage ? (
        <Card
          className={cn(
            "bg-background/95 shadow-sm",
            feedbackTone === "success"
              ? "border-emerald-500/40"
              : "border-destructive/40"
          )}
        >
          <CardContent
            className={cn(
              "p-6 text-sm",
              feedbackTone === "success" ? "text-emerald-700" : "text-destructive"
            )}
          >
            {feedbackMessage}
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/70 bg-background/95 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{copy.marketingBalanceTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatNumber(marketingSegmentTotal)}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {copy.plannedPrefix} {formatNumber(formValues.marketingTotal)} | {copy.gapPrefix}{" "}
              {formatNumber(formValues.marketingTotal - marketingSegmentTotal)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-background/95 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{copy.channelTotalTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatNumber(channelMixTotal)}%</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {copy.recommendedMixHint}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-background/95 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{copy.operatingSpendTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatNumber(totalOpex)}</p>
            <p className="mt-2 text-sm text-muted-foreground">{copy.operatingSpendHint}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-background/95 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{copy.capexFinancingTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatNumber(totalCapex)}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {copy.loanChangePrefix} {formatNumber(formValues.newLoanAmount - formValues.loanRepayment)}
            </p>
          </CardContent>
        </Card>
      </section>

      <StudentDecisionPresets
        locale={locale === "zh-CN" ? "zh-CN" : "en-US"}
        canEdit={Boolean(canEdit)}
        isBusy={mutation.isPending || decisionQuery.isLoading}
        activePresetId={activePresetId}
        onApply={handleApplyPreset}
      />

      <StudentStrategyAdvisor
        values={formValues}
        locale={locale === "zh-CN" ? "zh-CN" : "en-US"}
        hotelState={workspace.team.hotelState}
      />

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          persistDecision("submit");
        }}
      >
        {DECISION_FORM_GROUPS.map((group) => (
          <Card
            key={group.title}
            className="border-border/70 bg-background/95 shadow-sm"
          >
            <CardHeader>
              <CardTitle className="text-xl">
                {formGroupLabels[group.title]?.title ?? group.title}
              </CardTitle>
              <CardDescription>
                {formGroupLabels[group.title]?.description ?? group.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {group.fields.map((field) => (
                <div key={field.name}>
                  <label htmlFor={String(field.name)} className="text-sm font-medium">
                    {fieldLabels[field.name] ?? field.label}
                  </label>
                  <Input
                    id={String(field.name)}
                    type="number"
                    step={field.step ?? "1"}
                    min={field.min}
                    value={formValues[field.name]}
                    className="mt-2"
                    disabled={!canEdit || mutation.isPending || decisionQuery.isLoading}
                    onChange={(event) => {
                      updateField(field.name, event.target.value);
                    }}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        <Card className="border-border/70 bg-background/95 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">{copy.roundReadyTitle}</CardTitle>
            <CardDescription>
              {copy.roundReadyDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-w-sm">
              <label htmlFor="tax-strategy" className="text-sm font-medium">
                {copy.taxStrategyLabel}
              </label>
              <select
                id="tax-strategy"
                value={formValues.taxStrategy}
                className={selectClassName}
                disabled={!canEdit || mutation.isPending || decisionQuery.isLoading}
                onChange={(event) => {
                  updateField("taxStrategy", event.target.value);
                }}
              >
                {TAX_STRATEGY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {taxOptionLabels[option.value] ?? option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
              {canEdit
                ? copy.editableFooter
                : workspace.round
                  ? `${copy.readOnlyFooterPrefix} ${roundStatusLabel}, ${copy.readOnlyFooterSuffix}`
                  : copy.noActiveRoundFooter}
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={!canEdit || mutation.isPending || decisionQuery.isLoading}
                onClick={() => {
                  persistDecision("draft");
                }}
              >
                {mutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {copy.saveDraftButton}
              </Button>
              <Button
                type="submit"
                className="gap-2"
                disabled={!canEdit || mutation.isPending || decisionQuery.isLoading}
              >
                {mutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                {copy.submitButton}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
