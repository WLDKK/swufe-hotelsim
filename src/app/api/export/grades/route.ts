import { NextRequest, NextResponse } from "next/server";
import { getAccessibleClassRecord } from "@/lib/api/access";
import { getOptionalSearchParam } from "@/lib/api/requests";
import { apiError, apiSuccess, mapRouteError } from "@/lib/api/responses";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";
import {
  getLatestCompletedRoundNumberForClass,
  getResultsForClassRound,
} from "@/lib/dal/results";
import { rowsToCsv } from "@/lib/export/csv";

export const dynamic = "force-dynamic";

function buildGradeExportFilename(classId: string, roundNumber: number) {
  return `swufe-hotelsim-gradebook-class-${classId}-round-${roundNumber}.csv`;
}

export async function GET(request: NextRequest) {
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

    const classId = getOptionalSearchParam(request, "classId");
    const format = getOptionalSearchParam(request, "format") ?? "csv";
    const roundNumberParam = getOptionalSearchParam(request, "roundNumber");

    if (!classId) {
      return apiError(400, "classId is required.");
    }

    if (!["csv", "json"].includes(format)) {
      return apiError(400, "format must be csv or json.");
    }

    const accessibleClass = await getAccessibleClassRecord(session.user, classId);
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

    const roundNumber =
      parsedRoundNumber ?? (await getLatestCompletedRoundNumberForClass(classId));

    if (!roundNumber) {
      return apiError(
        404,
        "There are no completed results available to export as a gradebook yet."
      );
    }

    const results = await getResultsForClassRound(classId, roundNumber);
    if (results.length === 0) {
      return apiError(404, "No gradebook rows were found for the selected round.");
    }

    // Keep the gradebook export teacher-facing and spreadsheet-friendly by
    // flattening the grading fields together with the most important
    // simulation KPIs that explain why a team received its score.
    const rows = results.map((result) => ({
      roundNumber: result.roundNumber,
      rankOverall: result.rankOverall,
      teamName: result.team.name,
      hotelName: result.team.hotelName,
      totalRevenue: result.totalRevenue,
      netProfit: result.netProfit,
      occupancyRate: result.occupancyRate,
      adr: result.adr,
      revpar: result.revpar,
      overallMarketShare: result.overallMarketShare,
      guestSatisfactionEnd: result.guestSatisfactionEnd,
      esgScoreEnd: result.esgScoreEnd,
      teacherScore: result.teacherScore ?? "",
      teacherComment: result.teacherComment ?? "",
    }));

    if (format === "json") {
      return apiSuccess({
        classId,
        roundNumber,
        rows,
      });
    }

    // Prefix the CSV with a UTF-8 BOM so Excel opens Chinese text and teacher
    // comments without mojibake on default desktop installations.
    const csv = `\uFEFF${rowsToCsv(rows)}`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${buildGradeExportFilename(
          classId,
          roundNumber
        )}"`,
      },
    });
  } catch (error) {
    return mapRouteError(error);
  }
}
