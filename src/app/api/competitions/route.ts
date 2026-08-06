import { NextRequest } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { revalidateCacheTags, cacheTags } from "@/lib/cache";
import { getOptionalSearchParam } from "@/lib/api/requests";
import {
  apiError,
  apiSuccess,
  apiValidationError,
  mapRouteError,
} from "@/lib/api/responses";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";
import {
  createCompetition,
  getCompetitionById,
  listCompetitions,
  updateCompetitionStatus,
} from "@/lib/dal/competitions";
import { competitionCreateSchema, competitionStatusUpdateSchema } from "@/lib/validations/api";

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

const allowedStatusTransitions = {
  DRAFT: ["READY", "ARCHIVED"],
  READY: ["DRAFT", "ACTIVE", "ARCHIVED"],
  ACTIVE: ["COMPLETED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
} as const;

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireApiSession();
    if ("response" in authResult) return authResult.response;

    const { session } = authResult;
    const roleError = requireApiRoles(session.user, ["TEACHER", "ADMIN"]);
    if (roleError) return roleError;

    const parsed = competitionStatusUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiValidationError(parsed.error, "The competition status payload is invalid.");
    }

    const current = await getCompetitionById(parsed.data.competitionId);
    if (!current || (session.user.role !== "ADMIN" && current.createdById !== session.user.id)) {
      return apiError(404, "Competition not found.");
    }
    if (current.status === parsed.data.status) return apiSuccess({ competition: current });

    const allowed = allowedStatusTransitions[current.status] as readonly string[];
    if (!allowed.includes(parsed.data.status)) {
      return apiError(
        409,
        `Cannot move competition from ${current.status} to ${parsed.data.status}.`
      );
    }

    const competition = await updateCompetitionStatus(parsed.data.competitionId, parsed.data.status);
    await recordAuditLog({
      request,
      user: session.user,
      action: "competition.status.update",
      entityType: "competition",
      entityId: competition.id,
      details: { previousStatus: current.status, nextStatus: competition.status },
    });
    revalidateCacheTags([cacheTags.competitions, cacheTags.competition(competition.id)]);
    return apiSuccess({ competition });
  } catch (error) {
    return mapRouteError(error);
  }
}
