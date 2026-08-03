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
import { createAdvancement, listAdvancements } from "@/lib/dal/competitions";
import { advancementCreateSchema } from "@/lib/validations/api";

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
    const stageId = getOptionalSearchParam(request, "stageId");
    const teamId = getOptionalSearchParam(request, "teamId");

    const advancements = await listAdvancements({
      competitionId: competitionId ?? undefined,
      stageId: stageId ?? undefined,
      teamId: teamId ?? undefined,
    });

    return apiSuccess({ advancements });
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

    const parsed = advancementCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiValidationError(parsed.error, "The advancement payload is invalid.");
    }

    const advancement = await createAdvancement({
      competitionId: parsed.data.competitionId,
      stageId: parsed.data.stageId ?? null,
      teamId: parsed.data.teamId,
      sourceRoundId: parsed.data.sourceRoundId ?? null,
      targetClassId: parsed.data.targetClassId ?? null,
      status: parsed.data.status,
      note: parsed.data.note ?? null,
    });

    await recordAuditLog({
      request,
      user: session.user,
      action: "advancement.create",
      entityType: "advancement",
      entityId: advancement.id,
      details: {
        competitionId: advancement.competitionId,
        stageId: advancement.stageId,
        teamId: advancement.teamId,
        status: advancement.status,
      },
    });

    revalidateCacheTags([
      cacheTags.advancements,
      cacheTags.competition(parsed.data.competitionId),
      parsed.data.stageId ? cacheTags.stage(parsed.data.stageId) : null,
    ]);

    return apiSuccess({ advancement }, 201);
  } catch (error) {
    return mapRouteError(error);
  }
}
