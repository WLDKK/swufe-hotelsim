import { NextRequest } from "next/server";
import {
  getAccessibleClassRecord,
  getAccessibleTeamRecord,
} from "@/lib/api/access";
import {
  countPresentValues,
  getOptionalSearchParam,
} from "@/lib/api/requests";
import { apiError, apiSuccess, mapRouteError } from "@/lib/api/responses";
import { requireApiSession } from "@/lib/api/session";
import {
  getLatestCompletedRoundNumberForClass,
  getLatestResultForTeam,
  getLeaderboardForClass,
  getResultsForClassRound,
  listCompletedRoundNumbersForClass,
  listResultsForTeam,
} from "@/lib/dal/results";

// Results depend on the caller's session-scoped authorization and must always
// run dynamically rather than entering static route analysis.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireApiSession();
    if ("response" in authResult) {
      return authResult.response;
    }

    const { session } = authResult;
    const classId = getOptionalSearchParam(request, "classId");
    const teamId = getOptionalSearchParam(request, "teamId");
    const roundNumberParam = getOptionalSearchParam(request, "roundNumber");

    if (countPresentValues([classId, teamId]) !== 1) {
      return apiError(400, "Provide exactly one of classId or teamId.");
    }

    if (teamId) {
      if (session.user.role === "JUDGE") {
        return apiError(403, "Judges must request competition results by class and round.");
      }
      const accessibleTeam = await getAccessibleTeamRecord(session.user, teamId);
      if (!accessibleTeam) {
        return apiError(404, "Team not found.");
      }

      // Team mode powers the student-facing history view. Return both the
      // latest summary card payload and the full trail so the UI can render a
      // compact snapshot plus round-by-round history from one request.
      const [latestResult, results] = await Promise.all([
        getLatestResultForTeam(teamId),
        listResultsForTeam(teamId),
      ]);

      return apiSuccess({ latestResult, results });
    }

    const requestedClassId = classId;
    if (!requestedClassId) {
      return apiError(400, "Class not found.");
    }

    const accessibleClass = await getAccessibleClassRecord(
      session.user,
      requestedClassId
    );

    if (!accessibleClass) {
      return apiError(404, "Class not found.");
    }

    const parsedRoundNumber = roundNumberParam ? Number(roundNumberParam) : undefined;
    if (
      parsedRoundNumber !== undefined &&
      (!Number.isInteger(parsedRoundNumber) || parsedRoundNumber <= 0)
    ) {
      return apiError(400, "roundNumber must be a positive integer.");
    }

    const targetRoundNumber =
      parsedRoundNumber ??
      (await getLatestCompletedRoundNumberForClass(
        requestedClassId,
        session.user.role === "JUDGE" ? session.user.id : undefined
      ));

    if (!targetRoundNumber) {
      return apiSuccess({
        roundNumber: null,
        availableRoundNumbers: [],
        leaderboard: [],
        results: [],
      });
    }

    // Class mode powers rankings, teacher dashboard spotlights, grading, and
    // simulation review. The available round list is returned together with the
    // selected result set so clients can keep their round selector synchronized
    // with only completed rounds that actually have persisted output.
    const judgeId = session.user.role === "JUDGE" ? session.user.id : undefined;
    const [leaderboard, results, availableRoundNumbers] = await Promise.all([
      getLeaderboardForClass(requestedClassId, targetRoundNumber, judgeId),
      getResultsForClassRound(requestedClassId, targetRoundNumber, judgeId),
      listCompletedRoundNumbersForClass(requestedClassId, judgeId),
    ]);

    return apiSuccess({
      roundNumber: targetRoundNumber,
      availableRoundNumbers,
      leaderboard,
      results,
    });
  } catch (error) {
    return mapRouteError(error);
  }
}
