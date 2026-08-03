"use client";

import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
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
import { getClassStatusLabel } from "@/i18n/status-labels";

type StudentJoinClassPanelProps = {
  currentWorkspace: {
    team: {
      id: string;
      name: string;
      hotelName: string;
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
  } | null;
};

type ClassLookupResponse = {
  class: {
    id: string;
    name: string;
    joinCode: string;
    maxTeams: number;
    currentRound: number;
    maxRounds: number;
    status: string;
    semester: {
      id: string;
      name: string;
      code: string;
      creator: {
        id: string;
        name: string | null;
        email: string;
      };
    };
    _count: {
      teams: number;
    };
  };
};

export function StudentJoinClassPanel({
  currentWorkspace,
}: StudentJoinClassPanelProps) {
  const { locale, messages } = useLocale();
  const copy = messages.studentJoin;
  const [draftJoinCode, setDraftJoinCode] = useState("");
  const [submittedJoinCode, setSubmittedJoinCode] = useState("");
  const normalizedJoinCode = submittedJoinCode.trim();

  const lookupQuery = useQuery({
    queryKey: ["student-join-class-lookup", normalizedJoinCode],
    queryFn: () =>
      apiFetch<ClassLookupResponse>(
        `/api/classes?joinCode=${encodeURIComponent(normalizedJoinCode)}`
      ),
    enabled: normalizedJoinCode.length > 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const currentAssignmentLabel = currentWorkspace
    ? `${currentWorkspace.team.name} / ${currentWorkspace.courseClass.name}`
    : copy.currentAssignmentUnassigned;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmittedJoinCode(draftJoinCode.trim().toUpperCase());
  };

  return (
    <div className="flex flex-col gap-6">
      <StudentWorkspaceHero
        badgeLabel={copy.badgeLabel}
        title={copy.title}
        description={copy.description}
        statusTitle={copy.statusTitle}
        statusBody={
          currentWorkspace
            ? `${copy.assignedStatusPrefix} ${currentWorkspace.team.name} / ${currentWorkspace.courseClass.name}${copy.assignedStatusSuffix}`
            : copy.unassignedStatus
        }
        summaryItems={[
          {
            label: copy.currentStateLabel,
            value: currentAssignmentLabel,
            hint: currentWorkspace
              ? `${copy.roundHintPrefix} ${currentWorkspace.courseClass.currentRound} / ${currentWorkspace.courseClass.maxRounds}`
              : copy.unassignedHint,
          },
          {
            label: copy.lookupModeLabel,
            value: copy.lookupOnlyValue,
            hint: copy.note,
          },
          {
            label: copy.latestQueryLabel,
            value: normalizedJoinCode || "-",
            hint: copy.latestQueryHint,
          },
          {
            label: copy.nextActionLabel,
            value: currentWorkspace ? copy.nextActionAssigned : copy.nextActionUnassigned,
            hint: copy.nextActionHint,
          },
        ]}
        actions={[
          { href: "/student/dashboard", label: copy.actions.dashboard, variant: "default" },
          { href: "/student/team", label: copy.actions.team },
          { href: "/student/decisions", label: copy.actions.decisions },
        ]}
      />

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="dashboard-card-surface">
          <CardHeader>
            <CardTitle className="text-xl">{copy.verifyTitle}</CardTitle>
            <CardDescription>
              {copy.verifyDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="space-y-3" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label htmlFor="student-join-code" className="text-sm font-medium">
                  {copy.inputLabel}
                </label>
                <Input
                  id="student-join-code"
                  value={draftJoinCode}
                  placeholder={copy.inputPlaceholder}
                  onChange={(event) => {
                    setDraftJoinCode(event.target.value.toUpperCase());
                  }}
                />
              </div>
              <Button type="submit" className="gap-2" disabled={!draftJoinCode.trim()}>
                <Search className="size-4" />
                {copy.verifyButton}
              </Button>
            </form>

            <div className="dashboard-panel text-sm text-muted-foreground">
              {copy.note}
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-card-surface">
          <CardHeader>
            <CardTitle className="text-xl">{copy.resultTitle}</CardTitle>
            <CardDescription>
              {copy.resultDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!normalizedJoinCode ? (
              <div className="dashboard-panel-dashed">
                {copy.idleState}
              </div>
            ) : lookupQuery.isLoading ? (
              <div className="dashboard-panel flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {copy.loadingState}
              </div>
            ) : lookupQuery.error ? (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                {lookupQuery.error instanceof ApiClientError
                  ? lookupQuery.error.message
                  : copy.genericError}
              </div>
            ) : lookupQuery.data?.class ? (
              <>
                <div className="dashboard-panel">
                  <p className="text-sm text-muted-foreground">{copy.validClassLabel}</p>
                  <p className="mt-2 text-2xl font-semibold">
                    {lookupQuery.data.class.name}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {lookupQuery.data.class.semester.name} (
                    {lookupQuery.data.class.semester.code})
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="dashboard-panel">
                    <p className="text-sm text-muted-foreground">{copy.teacherOwnerLabel}</p>
                    <p className="mt-2 text-lg font-semibold">
                      {lookupQuery.data.class.semester.creator.name ??
                        lookupQuery.data.class.semester.creator.email}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {lookupQuery.data.class.semester.creator.email}
                    </p>
                  </div>
                  <div className="dashboard-panel">
                    <p className="text-sm text-muted-foreground">{copy.classProgressLabel}</p>
                    <p className="mt-2 text-lg font-semibold">
                      {lookupQuery.data.class.currentRound} / {lookupQuery.data.class.maxRounds}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {copy.statusLabel}{" "}
                      {getClassStatusLabel(locale, lookupQuery.data.class.status)} | {copy.teamsLabel}{" "}
                      {lookupQuery.data.class._count.teams} / {lookupQuery.data.class.maxTeams}
                    </p>
                  </div>
                </div>
                <div className="dashboard-panel text-sm text-muted-foreground">
                  {copy.validNote}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
