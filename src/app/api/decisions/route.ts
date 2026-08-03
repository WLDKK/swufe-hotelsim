import { DecisionStatus, RoundStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { revalidateTeamReadModels } from "@/lib/cache-invalidation";
import {
  getAccessibleClassRecord,
  getAccessibleRoundRecord,
  getAccessibleTeamRecord,
} from "@/lib/api/access";
import { getOptionalSearchParam } from "@/lib/api/requests";
import {
  apiError,
  apiSuccess,
  apiValidationError,
  mapRouteError,
} from "@/lib/api/responses";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";
import {
  getDecisionForTeamRound,
  listDecisionsForRound,
  saveDecisionDraft,
  submitDecision,
} from "@/lib/dal/decisions";
import { decisionMutationSchema } from "@/lib/validations/api";

// These handlers depend on the authenticated session and must always execute
// dynamically instead of participating in static optimization.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireApiSession();
    if ("response" in authResult) {
      return authResult.response;
    }

    const { session } = authResult;
    const teamId = getOptionalSearchParam(request, "teamId");
    const roundId = getOptionalSearchParam(request, "roundId");

    if (teamId) {
      if (!roundId) {
        return apiError(
          400,
          "Provide roundId together with teamId when requesting a single decision."
        );
      }

      const [accessibleTeam, accessibleRound] = await Promise.all([
        getAccessibleTeamRecord(session.user, teamId),
        getAccessibleRoundRecord(session.user, roundId),
      ]);

      if (!accessibleTeam) {
        return apiError(404, "Team not found.");
      }

      if (!accessibleRound) {
        return apiError(404, "Round not found.");
      }

      if (accessibleTeam.classId !== accessibleRound.classId) {
        return apiError(
          400,
          "The requested team and round do not belong to the same class."
        );
      }

      const decision = await getDecisionForTeamRound(teamId, roundId);
      return apiSuccess({ decision });
    }

    if (roundId) {
      const roleError = requireApiRoles(session.user, ["TEACHER", "ADMIN"]);
      if (roleError) {
        return roleError;
      }

      // Round-level decision listing is a teacher/admin monitoring workflow;
      // students fetch a single team+round record instead of the whole cohort.
      const accessibleRound = await getAccessibleRoundRecord(
        session.user,
        roundId
      );

      if (!accessibleRound) {
        return apiError(404, "Round not found.");
      }

      const decisions = await listDecisionsForRound(roundId);
      return apiSuccess({ decisions });
    }

    return apiError(
      400,
      "Provide roundId, or provide both teamId and roundId."
    );
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
    const parsed = decisionMutationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiValidationError(
        parsed.error,
        "The decision payload is invalid."
      );
    }

    const { mode, ...decisionData } = parsed.data;

    const [accessibleTeam, accessibleRound] = await Promise.all([
      getAccessibleTeamRecord(session.user, decisionData.teamId),
      getAccessibleRoundRecord(session.user, decisionData.roundId),
    ]);

    if (!accessibleTeam) {
      return apiError(404, "Team not found.");
    }

    if (!accessibleRound) {
      return apiError(404, "Round not found.");
    }

    if (accessibleTeam.classId !== accessibleRound.classId) {
      return apiError(
        400,
        "The selected team and round do not belong to the same class."
      );
    }

    const classRecord = await getAccessibleClassRecord(
      session.user,
      accessibleTeam.classId
    );

    if (!classRecord) {
      return apiError(404, "Class not found.");
    }

    if (classRecord.currentRound <= 0) {
      return apiError(
        409,
        "This class does not have an active round for decision entry yet."
      );
    }

    // Decision mutation is intentionally tied to the class.currentRound
    // pointer so student forms, teacher monitoring, and later engine jobs all
    // agree on which round is currently editable.
    if (accessibleRound.roundNumber !== classRecord.currentRound) {
      return apiError(
        409,
        "Only the current round can be edited through this endpoint."
      );
    }

    if (accessibleRound.status !== RoundStatus.PENDING) {
      return apiError(
        409,
        "This round is no longer open for decision changes."
      );
    }

    const existingDecision = await getDecisionForTeamRound(
      decisionData.teamId,
      decisionData.roundId
    );

    if (existingDecision?.status === DecisionStatus.LOCKED) {
      return apiError(
        409,
        "This decision has been locked and can no longer be edited."
      );
    }

    // The DAL owns the upsert mechanics and status transitions. The route only
    // decides whether this request should be treated as a draft save or a
    // formal submission after all access and round-state checks pass.
    const decision =
      mode === "draft"
        ? await saveDecisionDraft(decisionData)
        : await submitDecision({
            ...decisionData,
            submittedBy: session.user.id,
          });

    revalidateTeamReadModels({
      classId: accessibleTeam.classId,
      teamId: decisionData.teamId,
      affectedUserIds:
        session.user.role === "STUDENT" ? [session.user.id] : undefined,
    });

    return apiSuccess({ decision }, existingDecision ? 200 : 201);
  } catch (error) {
    return mapRouteError(error);
  }
}
