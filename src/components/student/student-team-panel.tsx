"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { StudentWorkspaceHero } from "@/components/student/student-workspace-hero";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { useLocale } from "@/i18n/use-locale";
import { getClassStatusLabel } from "@/i18n/status-labels";
import {
  formatCompactCurrency,
  formatNumber,
} from "@/lib/formatters";

type StudentTeamPanelProps = {
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
  };
};

type TeamRole =
  | "LEADER"
  | "MARKETING_MANAGER"
  | "OPERATIONS_MANAGER"
  | "FINANCE_MANAGER"
  | "REVENUE_MANAGER"
  | "MEMBER";

type TeamRecord = {
  id: string;
  name: string;
  hotelName: string;
  color: string;
  class: {
    id: string;
    name: string;
    joinCode: string;
    status: string;
    currentRound: number;
    maxRounds: number;
  };
  hotelState: {
    cashBalance: number;
    totalDebt: number;
    brandReputation: number;
    guestSatisfaction: number;
    esgScore: number;
  } | null;
  members: Array<{
    id: string;
    role: TeamRole;
    user: {
      id: string;
      name: string | null;
      email: string;
      studentId: string | null;
    };
  }>;
};

type TeamResponse = {
  teams: TeamRecord[];
};

const roleOrder: Record<TeamRole, number> = {
  LEADER: 0,
  REVENUE_MANAGER: 1,
  MARKETING_MANAGER: 2,
  OPERATIONS_MANAGER: 3,
  FINANCE_MANAGER: 4,
  MEMBER: 5,
};

export function StudentTeamPanel({ workspace }: StudentTeamPanelProps) {
  const { locale, messages } = useLocale();
  const copy = messages.studentTeam;

  const teamQuery = useQuery({
    queryKey: ["student-team-detail", workspace.courseClass.id],
    // Reuse the existing /api/teams student branch instead of inventing a new
    // team-only endpoint. The API already narrows students down to their own
    // team record, so the page gets live roster data without broadening auth.
    queryFn: () =>
      apiFetch<TeamResponse>(`/api/teams?classId=${workspace.courseClass.id}`),
    refetchOnWindowFocus: false,
  });

  const team = teamQuery.data?.teams[0] ?? null;
  const members = useMemo(
    () =>
      [...(team?.members ?? [])].sort((left, right) => {
        const byRole = roleOrder[left.role] - roleOrder[right.role];
        if (byRole !== 0) {
          return byRole;
        }

        return (left.user.name ?? left.user.email).localeCompare(
          right.user.name ?? right.user.email
        );
      }),
    [team?.members]
  );
  const leader = members.find((member) => member.role === "LEADER") ?? null;
  const hotelState = team?.hotelState ?? workspace.team.hotelState;
  const roleLabels = copy.roleLabels as Record<TeamRole, string>;
  const classStatusLabel = getClassStatusLabel(
    locale,
    team?.class.status ?? workspace.courseClass.status
  );

  return (
    <div className="flex flex-col gap-6">
      <StudentWorkspaceHero
        badgeLabel={copy.badgeLabel}
        title={`${copy.titlePrefix} ${workspace.team.name}`}
        description={copy.description}
        statusTitle={copy.statusTitle}
        statusBody={
          team
            ? copy.statusBodyLoaded
            : copy.statusBodyLoading
        }
        summaryItems={[
          {
            label: copy.classLabel,
            value: workspace.courseClass.name,
            hint: `${workspace.courseClass.semester.name} (${workspace.courseClass.semester.code})`,
          },
          {
            label: copy.hotelLabel,
            value: workspace.team.hotelName,
            hint: `${copy.classStatusHintPrefix} ${classStatusLabel}`,
          },
          {
            label: copy.membersLabel,
            value: team ? String(team.members.length) : "-",
            hint: leader
              ? `${copy.leaderHintPrefix} ${leader.user.name ?? leader.user.email}`
              : copy.leaderHintEmpty,
          },
          {
            label: copy.joinCodeLabel,
            value: team?.class.joinCode ?? "-",
            hint: copy.joinCodeHint,
          },
        ]}
        actions={[
          { href: "/student/dashboard", label: copy.actions.dashboard, variant: "default" },
          { href: "/student/decisions", label: copy.actions.decisions },
          { href: "/student/results", label: copy.actions.results },
          { href: "/student/join", label: copy.actions.join },
        ]}
      />

      {teamQuery.isLoading ? (
        <Card className="dashboard-card-surface">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {copy.loadingCard}
          </CardContent>
        </Card>
      ) : teamQuery.error ? (
        <Card className="dashboard-card-alert">
          <CardContent className="p-6 text-sm text-destructive">
            {teamQuery.error instanceof ApiClientError
              ? teamQuery.error.message
              : copy.genericError}
          </CardContent>
        </Card>
      ) : !team ? (
        <Card className="dashboard-card-surface">
          <CardContent className="p-6 text-sm text-muted-foreground">
            {copy.missingTeamState}
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-[0.96fr_1.04fr]">
            <Card className="dashboard-card-surface">
              <CardHeader>
                <CardTitle className="text-xl">{copy.assignmentTitle}</CardTitle>
                <CardDescription>
                  {copy.assignmentDescription}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="dashboard-panel">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">{copy.joinCodeCardLabel}</p>
                      <p className="mt-2 text-2xl font-semibold">{team.class.joinCode}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className="size-5 rounded-full border border-white/15"
                        style={{ backgroundColor: team.color }}
                        aria-hidden="true"
                      />
                      <Badge variant="outline">{classStatusLabel}</Badge>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="dashboard-panel">
                    <p className="text-sm text-muted-foreground">{copy.currentRoundLabel}</p>
                    <p className="mt-2 text-xl font-semibold">
                      {team.class.currentRound} / {team.class.maxRounds}
                    </p>
                  </div>
                  <div className="dashboard-panel">
                    <p className="text-sm text-muted-foreground">{copy.leaderLabel}</p>
                    <p className="mt-2 text-xl font-semibold">
                      {leader?.user.name ?? leader?.user.email ?? "-"}
                    </p>
                  </div>
                </div>
                <div className="dashboard-panel text-sm text-muted-foreground">
                  {copy.rosterNote}
                </div>
              </CardContent>
            </Card>

            <Card className="dashboard-card-surface">
              <CardHeader>
                <CardTitle className="text-xl">{copy.rosterTitle}</CardTitle>
                <CardDescription>
                  {copy.rosterDescription}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="dashboard-panel"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">
                          {member.user.name ?? member.user.email}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {member.user.email}
                          {member.user.studentId ? ` | ${member.user.studentId}` : ""}
                        </p>
                      </div>
                      <Badge variant={member.role === "LEADER" ? "default" : "outline"}>
                        {roleLabels[member.role]}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Card className="dashboard-card-surface">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{copy.cashLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {formatCompactCurrency(hotelState?.cashBalance)}
                </p>
              </CardContent>
            </Card>
            <Card className="dashboard-card-surface">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{copy.debtLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {formatCompactCurrency(hotelState?.totalDebt)}
                </p>
              </CardContent>
            </Card>
            <Card className="dashboard-card-surface">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{copy.brandLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {formatNumber(hotelState?.brandReputation)}
                </p>
              </CardContent>
            </Card>
            <Card className="dashboard-card-surface">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{copy.guestScoreLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {formatNumber(hotelState?.guestSatisfaction)}
                </p>
              </CardContent>
            </Card>
            <Card className="dashboard-card-surface">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{copy.esgLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {formatNumber(hotelState?.esgScore)}
                </p>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
