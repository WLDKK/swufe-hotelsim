import { NextRequest } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { revalidateCacheTags, cacheTags } from "@/lib/cache";
import { getOptionalSearchParam } from "@/lib/api/requests";
import {
  apiSuccess,
  apiValidationError,
  mapRouteError,
} from "@/lib/api/responses";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";
import {
  createCompetition,
  getCompetitionById,
  listCompetitions,
} from "@/lib/dal/competitions";
import { competitionCreateSchema } from "@/lib/validations/api";

export const dynamic = "force-dynamic";

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

    const competitionId = getOptionalSearchParam(request, "competitionId");
    const status = getOptionalSearchParam(request, "status");

    if (competitionId) {
      const competition = await getCompetitionById(competitionId);
      return apiSuccess({ competition });
    }

    const competitions = await listCompetitions(
      status && ["DRAFT", "READY", "ACTIVE", "COMPLETED", "ARCHIVED"].includes(status)
        ? (status as "DRAFT" | "READY" | "ACTIVE" | "COMPLETED" | "ARCHIVED")
        : undefined
    );

    return apiSuccess({ competitions });
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
    const roleError = requireApiRoles(session.user, ["TEACHER", "ADMIN"]);
    if (roleError) {
      return roleError;
    }

    const parsed = competitionCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiValidationError(parsed.error, "The competition payload is invalid.");
    }

    const competition = await createCompetition({
      name: parsed.data.name,
      code: parsed.data.code,
      description: parsed.data.description ?? null,
      status: parsed.data.status,
      legacySemesterId: parsed.data.legacySemesterId ?? null,
      rulesetId: parsed.data.rulesetId ?? null,
      createdById: session.user.id,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
    });

    await recordAuditLog({
      request,
      user: session.user,
      action: "competition.create",
      entityType: "competition",
      entityId: competition.id,
      details: {
        code: competition.code,
        status: competition.status,
        rulesetId: competition.rulesetId,
      },
    });

    revalidateCacheTags([cacheTags.competitions]);

    return apiSuccess({ competition }, 201);
  } catch (error) {
    return mapRouteError(error);
  }
}
