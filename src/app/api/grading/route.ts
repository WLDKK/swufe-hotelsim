import { NextRequest } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { revalidateRoundReadModels } from "@/lib/cache-invalidation";
import { getAccessibleClassRecord } from "@/lib/api/access";
import {
  apiError,
  apiSuccess,
  apiValidationError,
  mapRouteError,
} from "@/lib/api/responses";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";
import {
  getRoundResultById,
} from "@/lib/dal/results";
import { upsertJudgeScoreForResult } from "@/lib/dal/judge-scores";
import { gradingMutationSchema } from "@/lib/validations/api";

// Teacher grading is permission-gated and session-backed, so it must always
// execute dynamically rather than participating in static optimization.
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireApiSession();
    if ("response" in authResult) {
      return authResult.response;
    }

    const { session } = authResult;
    const roleError = requireApiRoles(session.user, ["TEACHER", "ADMIN"]);
    if (roleError) {
      return roleError;
    }

    const parsed = gradingMutationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiValidationError(parsed.error, "The grading payload is invalid.");
    }

    const existingResult = await getRoundResultById(parsed.data.resultId);
    if (!existingResult) {
      return apiError(404, "Round result not found.");
    }

    const accessibleClass = await getAccessibleClassRecord(
      session.user,
      existingResult.team.classId
    );

    if (!accessibleClass) {
      return apiError(404, "Round result not found.");
    }

    const patch = {
      ...(parsed.data.teacherScore !== undefined
        ? { teacherScore: parsed.data.teacherScore }
        : {}),
      ...(parsed.data.teacherComment !== undefined
        ? { teacherComment: parsed.data.teacherComment }
        : {}),
    };

    // Preserve the existing teacher-facing PATCH contract, but persist the
    // data through the forward-looking judge-score store so later competition
    // flows can reuse the same result records without another migration.
    const result = await upsertJudgeScoreForResult({
      resultId: parsed.data.resultId,
      judgeId: session.user.id,
      score: parsed.data.teacherScore,
      comment: parsed.data.teacherComment,
    });

    await recordAuditLog({
      request,
      user: session.user,
      action: "grading.save",
      entityType: "round_result",
      entityId: parsed.data.resultId,
      details: {
        classId: existingResult.team.classId,
        roundId: existingResult.round.id,
        roundNumber: existingResult.round.roundNumber,
        teamId: existingResult.team.id,
        teacherScore: patch.teacherScore ?? null,
        teacherCommentLength:
          typeof patch.teacherComment === "string"
            ? patch.teacherComment.length
            : undefined,
      },
    });

    revalidateRoundReadModels({
      classId: existingResult.team.classId,
      roundId: existingResult.round.id,
      teamIds: [existingResult.team.id],
    });

    return apiSuccess({ result });
  } catch (error) {
    return mapRouteError(error);
  }
}
