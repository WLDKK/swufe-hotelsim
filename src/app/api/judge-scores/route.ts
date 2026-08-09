import { NextRequest } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { revalidateRoundReadModels } from "@/lib/cache-invalidation";
import { getAccessibleClassRecord, getAccessibleRoundRecord } from "@/lib/api/access";
import { getOptionalSearchParam } from "@/lib/api/requests";
import {
  apiError,
  apiSuccess,
  apiValidationError,
  mapRouteError,
} from "@/lib/api/responses";
import {
  type ApiSessionUser,
  requireApiRoles,
  requireApiSession,
} from "@/lib/api/session";
import { upsertJudgeScoreForResult } from "@/lib/dal/judge-scores";
import { getRoundResultById } from "@/lib/dal/results";
import { judgeScoreMutationSchema } from "@/lib/validations/api";

export const dynamic = "force-dynamic";

async function getAccessibleResultForJudgeLikeUser(input: {
  requestUser: ApiSessionUser;
  resultId: string;
}) {
  const result = await getRoundResultById(input.resultId);
  if (!result) {
    return null;
  }

  if (input.requestUser.role === "ADMIN") {
    return result;
  }

  if (input.requestUser.role === "JUDGE") {
    const accessibleRound = await getAccessibleRoundRecord(
      input.requestUser,
      result.round.id
    );
    return accessibleRound ? result : null;
  }

  const accessibleClass = await getAccessibleClassRecord(
    input.requestUser,
    result.team.classId
  );

  return accessibleClass ? result : null;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireApiSession();
    if ("response" in authResult) {
      return authResult.response;
    }

    const { session } = authResult;
    const roleError = requireApiRoles(session.user, ["TEACHER", "ADMIN", "JUDGE"]);
    if (roleError) {
      return roleError;
    }

    const resultId = getOptionalSearchParam(request, "resultId");
    if (!resultId) {
      return apiError(400, "resultId is required.");
    }

    const result = await getAccessibleResultForJudgeLikeUser({
      requestUser: session.user,
      resultId,
    });
    if (!result) {
      return apiError(404, "Round result not found.");
    }

    return apiSuccess({
      result,
      judgeScores: result.judgeScores,
    });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireApiSession();
    if ("response" in authResult) {
      return authResult.response;
    }

    const { session } = authResult;
    const roleError = requireApiRoles(session.user, ["TEACHER", "ADMIN", "JUDGE"]);
    if (roleError) {
      return roleError;
    }

    const parsed = judgeScoreMutationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiValidationError(parsed.error, "The judge score payload is invalid.");
    }

    const existingResult = await getAccessibleResultForJudgeLikeUser({
      requestUser: session.user,
      resultId: parsed.data.resultId,
    });
    if (!existingResult) {
      return apiError(404, "Round result not found.");
    }

    const result = await upsertJudgeScoreForResult({
      resultId: parsed.data.resultId,
      judgeId: session.user.id,
      score: parsed.data.score,
      comment: parsed.data.comment,
      breakdown: parsed.data.breakdown,
    });

    await recordAuditLog({
      request,
      user: session.user,
      action: "judge-score.save",
      entityType: "round_result",
      entityId: parsed.data.resultId,
      details: {
        roundId: existingResult.round.id,
        roundNumber: existingResult.round.roundNumber,
        teamId: existingResult.team.id,
        classId: existingResult.team.classId,
        score: parsed.data.score ?? null,
        commentLength:
          typeof parsed.data.comment === "string" ? parsed.data.comment.length : undefined,
      },
    });

    revalidateRoundReadModels({
      classId: existingResult.team.classId,
      roundId: existingResult.round.id,
      teamIds: [existingResult.team.id],
    });

    return apiSuccess({ result, judgeScores: result.judgeScores });
  } catch (error) {
    return mapRouteError(error);
  }
}
