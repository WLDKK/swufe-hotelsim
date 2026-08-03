import { NextRequest, NextResponse } from "next/server";
import { getAccessibleClassRecord } from "@/lib/api/access";
import { getOptionalSearchParam } from "@/lib/api/requests";
import { apiError, apiSuccess, mapRouteError } from "@/lib/api/responses";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";
import { listDecisionsForRound } from "@/lib/dal/decisions";
import {
  getLatestCompletedRoundNumberForClass,
  getLeaderboardForClass,
  getResultsForClassRound,
} from "@/lib/dal/results";
import { getRoundByClassAndNumber } from "@/lib/dal/rounds";
import { rowsToCsv } from "@/lib/export/csv";

// Exports are permission-gated and session-backed, so they should always be
// treated as dynamic request handlers.
export const dynamic = "force-dynamic";

function buildExportFilename(
  scope: string,
  classId: string,
  roundNumber: number,
  extension: string
) {
  return `swufe-hotelsim-${scope}-class-${classId}-round-${roundNumber}.${extension}`;
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
    const scope = getOptionalSearchParam(request, "scope") ?? "results";
    const format = getOptionalSearchParam(request, "format") ?? "csv";
    const roundNumberParam = getOptionalSearchParam(request, "roundNumber");

    if (!classId) {
      return apiError(400, "classId is required.");
    }

    if (!["results", "leaderboard", "decisions"].includes(scope)) {
      return apiError(400, "scope must be results, leaderboard, or decisions.");
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
        "There are no completed simulation results available to export yet."
      );
    }

    const round = await getRoundByClassAndNumber(classId, roundNumber);
    if (!round) {
      return apiError(404, "Round not found.");
    }

    // The export scopes intentionally reuse the same DAL/result contracts as
    // the live dashboard screens. That keeps reporting, CSV export, and future
    // external integrations aligned on one source of truth.
    let rows: Array<Record<string, unknown>>;

    if (scope === "results") {
      const results = await getResultsForClassRound(classId, roundNumber);
      rows = results.map((result) => ({
        rankOverall: result.rankOverall,
        teamName: result.team.name,
        hotelName: result.team.hotelName,
        occupancyRate: result.occupancyRate,
        adr: result.adr,
        revpar: result.revpar,
        totalRevenue: result.totalRevenue,
        netProfit: result.netProfit,
        overallMarketShare: result.overallMarketShare,
        guestSatisfactionEnd: result.guestSatisfactionEnd,
        esgScoreEnd: result.esgScoreEnd,
        cashBalanceEnd: result.cashBalanceEnd,
        totalDebtEnd: result.totalDebtEnd,
      }));
    } else if (scope === "leaderboard") {
      const leaderboard = await getLeaderboardForClass(classId, roundNumber);
      rows = leaderboard.map((entry) => ({
        rankOverall: entry.rankOverall,
        rankRevenue: entry.rankRevenue,
        rankProfit: entry.rankProfit,
        teamName: entry.team.name,
        hotelName: entry.team.hotelName,
        occupancyRate: entry.occupancyRate,
        adr: entry.adr,
        revpar: entry.revpar,
        totalRevenue: entry.totalRevenue,
        netProfit: entry.netProfit,
        overallMarketShare: entry.overallMarketShare,
      }));
    } else {
      const decisions = await listDecisionsForRound(round.id);
      rows = decisions.map((decision) => ({
        teamName: decision.team.name,
        decisionStatus: decision.status,
        submittedAt: decision.submittedAt?.toISOString() ?? "",
        priceBusinessTransient: decision.priceBusinessTransient,
        priceBusinessGroup: decision.priceBusinessGroup,
        priceLeisureTransient: decision.priceLeisureTransient,
        priceLeisureGroup: decision.priceLeisureGroup,
        marketingTotal: decision.marketingTotal,
        channelDirect: decision.channelDirect,
        channelOTA: decision.channelOTA,
        opexRoomsMaintenance: decision.opexRoomsMaintenance,
        capexRenovation: decision.capexRenovation,
        newLoanAmount: decision.newLoanAmount,
        esgEnergyInvestment: decision.esgEnergyInvestment,
        taxStrategy: decision.taxStrategy,
      }));
    }

    if (format === "json") {
      return apiSuccess({
        scope,
        classId,
        roundNumber,
        rows,
      });
    }

    const csv = rowsToCsv(rows);

    // CSV stays dependency-light on purpose so later handoff work can extend
    // exports without introducing a separate spreadsheet/reporting stack first.
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${buildExportFilename(
          scope,
          classId,
          roundNumber,
          "csv"
        )}"`,
      },
    });
  } catch (error) {
    return mapRouteError(error);
  }
}
