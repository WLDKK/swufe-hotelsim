import { NextRequest } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { cacheTags, revalidateCacheTags } from "@/lib/cache";
import { getOptionalSearchParam } from "@/lib/api/requests";
import {
  apiError,
  apiSuccess,
  apiValidationError,
  mapRouteError,
} from "@/lib/api/responses";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";
import {
  assignJudgeToCompetition,
  listJudgeAssignments,
  removeJudgeFromCompetition,
} from "@/lib/dal/competitions";
import { getUserAdminSummaryById } from "@/lib/dal/users";
import { judgeAssignmentMutationSchema } from "@/lib/validations/api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireApiSession();
    if ("response" in authResult) return authResult.response;

    const roleError = requireApiRoles(authResult.session.user, ["ADMIN"]);
    if (roleError) return roleError;

    const competitionId = getOptionalSearchParam(request, "competitionId");
    const assignments = await listJudgeAssignments(competitionId ?? undefined);
    return apiSuccess({ assignments });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireApiSession();
    if ("response" in authResult) return authResult.response;

    const { session } = authResult;
    const roleError = requireApiRoles(session.user, ["ADMIN"]);
    if (roleError) return roleError;

    const parsed = judgeAssignmentMutationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiValidationError(parsed.error, "The judge assignment payload is invalid.");
    }

    const judge = await getUserAdminSummaryById(parsed.data.judgeId);
    if (!judge || judge.role !== "JUDGE") {
      return apiError(400, "The selected user is not a judge.");
    }

    const assignment = await assignJudgeToCompetition({
      ...parsed.data,
      createdById: session.user.id,
    });

    await recordAuditLog({
      request,
      user: session.user,
      action: "competition.judge.assign",
      entityType: "competition_judge_assignment",
      entityId: assignment.id,
      details: parsed.data,
    });

    revalidateCacheTags([
      cacheTags.judgeAssignments,
      cacheTags.competitions,
      cacheTags.competition(parsed.data.competitionId),
      cacheTags.classes,
    ]);
    return apiSuccess({ assignment }, 201);
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireApiSession();
    if ("response" in authResult) return authResult.response;

    const { session } = authResult;
    const roleError = requireApiRoles(session.user, ["ADMIN"]);
    if (roleError) return roleError;

    const parsed = judgeAssignmentMutationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiValidationError(parsed.error, "The judge assignment payload is invalid.");
    }

    const assignment = await removeJudgeFromCompetition(parsed.data);
    await recordAuditLog({
      request,
      user: session.user,
      action: "competition.judge.remove",
      entityType: "competition_judge_assignment",
      entityId: assignment.id,
      details: parsed.data,
    });

    revalidateCacheTags([
      cacheTags.judgeAssignments,
      cacheTags.competitions,
      cacheTags.competition(parsed.data.competitionId),
      cacheTags.classes,
    ]);
    return apiSuccess({ removed: true });
  } catch (error) {
    return mapRouteError(error);
  }
}
