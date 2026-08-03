import { TeamRole, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { revalidateTeamReadModels } from "@/lib/cache-invalidation";
import { getAccessibleClassRecord } from "@/lib/api/access";
import { getOptionalSearchParam } from "@/lib/api/requests";
import {
  apiError,
  apiSuccess,
  apiValidationError,
  mapRouteError,
} from "@/lib/api/responses";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";
import {
  getClassRosterImportState,
  listTeamsForClass,
  replaceClassRoster,
} from "@/lib/dal/teams";
import prisma from "@/lib/prisma";
import {
  buildRosterCsvFromTeams,
  buildRosterCsvTemplate,
  parseRosterCsv,
  type ParsedRosterImportPlan,
  type RosterCsvIssue,
} from "@/lib/roster/csv";
import { rosterCsvMutationSchema } from "@/lib/validations/api";

export const dynamic = "force-dynamic";

function buildFilename(kind: "template" | "roster", classId?: string) {
  if (kind === "template") {
    return "swufe-hotelsim-roster-template.csv";
  }

  return `swufe-hotelsim-roster-class-${classId}.csv`;
}

function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

type ResolvedRosterTeam = {
  name: string;
  hotelName: string;
  color?: string | null;
  members: Array<{
    userId: string;
    role: TeamRole;
    label: string;
  }>;
};

async function resolveRosterImportPlan(plan: ParsedRosterImportPlan) {
  const issues: RosterCsvIssue[] = [];
  const emails = Array.from(
    new Set(
      plan.teams.flatMap((team) =>
        team.members
          .map((member) => member.studentEmail)
          .filter((value): value is string => Boolean(value))
      )
    )
  );
  const studentIds = Array.from(
    new Set(
      plan.teams.flatMap((team) =>
        team.members
          .map((member) => member.studentId)
          .filter((value): value is string => Boolean(value))
      )
    )
  );

  const users = await prisma.user.findMany({
    where: {
      OR: [
        ...(emails.length > 0
          ? [
              {
                email: {
                  in: emails,
                },
              },
            ]
          : []),
        ...(studentIds.length > 0
          ? [
              {
                studentId: {
                  in: studentIds,
                },
              },
            ]
          : []),
      ],
    },
    select: {
      id: true,
      email: true,
      studentId: true,
      role: true,
      name: true,
    },
  });

  const usersByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  const usersByStudentId = new Map(
    users
      .filter((user) => user.studentId)
      .map((user) => [user.studentId as string, user])
  );
  const resolvedUserIds = new Set<string>();
  const resolvedTeams: ResolvedRosterTeam[] = [];

  for (const team of plan.teams) {
    const resolvedMembers: ResolvedRosterTeam["members"] = [];

    for (const member of team.members) {
      // CSV rows can identify students by email, student ID, or both. Resolve
      // both forms here so spreadsheet imports stay operator-friendly while we
      // still collapse onto one canonical userId before touching team tables.
      const byEmail = member.studentEmail
        ? usersByEmail.get(member.studentEmail.toLowerCase()) ?? null
        : null;
      const byStudentId = member.studentId
        ? usersByStudentId.get(member.studentId) ?? null
        : null;
      const resolvedUser = byEmail ?? byStudentId;

      if (byEmail && byStudentId && byEmail.id !== byStudentId.id) {
        issues.push({
          rowNumber: member.rowNumber,
          field: "student_email",
          message:
            "student_email and student_id point to different users on the same CSV row.",
        });
        continue;
      }

      if (!resolvedUser) {
        issues.push({
          rowNumber: member.rowNumber,
          field: "student_email",
          message:
            "The referenced student account could not be found by email or student ID.",
        });
        continue;
      }

      if (resolvedUser.role !== UserRole.STUDENT) {
        issues.push({
          rowNumber: member.rowNumber,
          field: "student_email",
          message: `${resolvedUser.email} is not a student account and cannot join a team.`,
        });
        continue;
      }

      if (resolvedUserIds.has(resolvedUser.id)) {
        issues.push({
          rowNumber: member.rowNumber,
          field: "student_email",
          message: `${resolvedUser.email} is assigned more than once in the CSV file.`,
        });
        continue;
      }

      resolvedUserIds.add(resolvedUser.id);
      resolvedMembers.push({
        userId: resolvedUser.id,
        role: member.teamRole,
        label:
          resolvedUser.name?.trim() ||
          resolvedUser.studentId ||
          resolvedUser.email,
      });
    }

    resolvedTeams.push({
      name: team.teamName,
      hotelName: team.hotelName,
      color: team.color,
      members: resolvedMembers,
    });
  }

  return {
    teams: resolvedTeams,
    issues,
  };
}

function buildImportSummary(teams: ResolvedRosterTeam[]) {
  return {
    teams: teams.length,
    members: teams.reduce((sum, team) => sum + team.members.length, 0),
    leaders: teams.reduce(
      (sum, team) =>
        sum + team.members.filter((member) => member.role === TeamRole.LEADER).length,
      0
    ),
  };
}

function buildPreview(teams: ResolvedRosterTeam[]) {
  return teams.map((team) => ({
    teamName: team.name,
    hotelName: team.hotelName,
    color: team.color ?? "#8B1A1A",
    memberCount: team.members.length,
    leaderLabel:
      team.members.find((member) => member.role === TeamRole.LEADER)?.label ?? "N/A",
  }));
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireApiSession();
    if ("response" in authResult) {
      return authResult.response;
    }

    const { session } = authResult;
    const roleError = requireApiRoles(session.user, ["ADMIN"]);
    if (roleError) {
      return roleError;
    }

    const template = getOptionalSearchParam(request, "template");
    if (template === "1" || template === "true") {
      return csvResponse(buildRosterCsvTemplate(), buildFilename("template"));
    }

    const classId = getOptionalSearchParam(request, "classId");
    if (!classId) {
      return apiError(400, "Provide classId or template=true when exporting roster CSV.");
    }

    const accessibleClass = await getAccessibleClassRecord(session.user, classId);
    if (!accessibleClass) {
      return apiError(404, "Class not found.");
    }

    const teams = await listTeamsForClass(classId);
    return csvResponse(buildRosterCsvFromTeams(teams), buildFilename("roster", classId));
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireApiSession();
    if ("response" in authResult) {
      return authResult.response;
    }

    const { session } = authResult;
    const roleError = requireApiRoles(session.user, ["ADMIN"]);
    if (roleError) {
      return roleError;
    }

    const parsed = rosterCsvMutationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiValidationError(parsed.error, "The roster CSV payload is invalid.");
    }

    const accessibleClass = await getAccessibleClassRecord(
      session.user,
      parsed.data.classId
    );
    if (!accessibleClass) {
      return apiError(404, "Class not found.");
    }

    const parsedPlan = parseRosterCsv(parsed.data.csvText);
    if (parsedPlan.issues.length > 0) {
      return apiError(400, "Roster CSV validation failed.", {
        issues: parsedPlan.issues,
      });
    }

    const resolvedPlan = await resolveRosterImportPlan(parsedPlan);
    if (resolvedPlan.issues.length > 0) {
      return apiError(400, "Roster CSV references invalid student rows.", {
        issues: resolvedPlan.issues,
      });
    }

    if (resolvedPlan.teams.length > accessibleClass.maxTeams) {
      return apiError(
        400,
        `This class allows at most ${accessibleClass.maxTeams} teams per import.`
      );
    }

    const invalidTeamSizes = resolvedPlan.teams
      .filter(
        (team) =>
          team.members.length < accessibleClass.minTeamSize ||
          team.members.length > accessibleClass.maxTeamSize
      )
      .map((team) => ({
        teamName: team.name,
        memberCount: team.members.length,
      }));

    if (invalidTeamSizes.length > 0) {
      return apiError(
        400,
        "One or more imported teams fall outside the class team-size limits.",
        {
          minTeamSize: accessibleClass.minTeamSize,
          maxTeamSize: accessibleClass.maxTeamSize,
          invalidTeamSizes,
        }
      );
    }

    const summary = buildImportSummary(resolvedPlan.teams);
    const preview = buildPreview(resolvedPlan.teams);

    if (parsed.data.mode === "validate") {
      // Validation mode lets admins test a spreadsheet safely before the
      // destructive setup-only replace flow is attempted.
      return apiSuccess({
        mode: "validate",
        summary,
        preview,
      });
    }

    const importState = await getClassRosterImportState(parsed.data.classId);
    if (!importState) {
      return apiError(404, "Class not found.");
    }

    if (
      importState.currentRound > 0 ||
      importState.teams.some(
        (team) => team._count.decisions > 0 || team._count.results > 0
      )
    ) {
      // Batch CSV import deliberately stops once historical gameplay exists.
      // At that point admins should use the interactive roster tools so
      // downstream decisions/results/grading remain auditable.
      return apiError(
        409,
        "Bulk roster replacement is only allowed before the class has started processing rounds."
      );
    }

    const replacedTeamCount = importState.teams.length;
    await replaceClassRoster(parsed.data.classId, resolvedPlan.teams);
    await recordAuditLog({
      request,
      user: session.user,
      action: "roster.csv.apply",
      entityType: "class",
      entityId: parsed.data.classId,
      details: {
        replacedTeamCount,
        createdTeamCount: resolvedPlan.teams.length,
        summary,
        teamNames: resolvedPlan.teams.map((team) => team.name),
      },
    });

    revalidateTeamReadModels({
      classId: parsed.data.classId,
      affectedUserIds: resolvedPlan.teams.flatMap((team) =>
        team.members.map((member) => member.userId)
      ),
    });

    return apiSuccess({
      mode: "apply",
      summary,
      preview,
      replacedTeamCount,
      createdTeamCount: resolvedPlan.teams.length,
    });
  } catch (error) {
    return mapRouteError(error);
  }
}
