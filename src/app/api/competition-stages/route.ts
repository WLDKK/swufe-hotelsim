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
  createCompetitionStage,
  listCompetitionStages,
} from "@/lib/dal/competitions";
import { competitionStageCreateSchema } from "@/lib/validations/api";

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
    const stages = await listCompetitionStages(competitionId ?? undefined);
    return apiSuccess({ stages });
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

    const parsed = competitionStageCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiValidationError(parsed.error, "The stage payload is invalid.");
    }

    const stage = await createCompetitionStage({
      competitionId: parsed.data.competitionId,
      name: parsed.data.name,
      stageOrder: parsed.data.stageOrder,
      description: parsed.data.description ?? null,
      status: parsed.data.status,
      maxRounds: parsed.data.maxRounds ?? null,
    });

    await recordAuditLog({
      request,
      user: session.user,
      action: "competition-stage.create",
      entityType: "competition_stage",
      entityId: stage.id,
      details: {
        competitionId: stage.competitionId,
        stageOrder: stage.stageOrder,
        status: stage.status,
      },
    });

    revalidateCacheTags([
      cacheTags.stages,
      cacheTags.competition(parsed.data.competitionId),
    ]);

    return apiSuccess({ stage }, 201);
  } catch (error) {
    return mapRouteError(error);
  }
}
