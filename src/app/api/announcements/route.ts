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
import { createAnnouncement, listAnnouncements } from "@/lib/dal/competitions";
import { announcementCreateSchema } from "@/lib/validations/api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const competitionId = getOptionalSearchParam(request, "competitionId");
    const publishedOnlyParam = getOptionalSearchParam(request, "publishedOnly");
    const publishedOnly = publishedOnlyParam !== "false";

    if (!publishedOnly) {
      const authResult = await requireApiSession();
      if ("response" in authResult) {
        return authResult.response;
      }

      const roleError = requireApiRoles(authResult.session.user, [
        "TEACHER",
        "ADMIN",
        "JUDGE",
      ]);
      if (roleError) {
        return roleError;
      }
    }

    const announcements = await listAnnouncements({
      competitionId: competitionId ?? undefined,
      publishedOnly,
    });

    return apiSuccess({ announcements });
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

    const parsed = announcementCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiValidationError(parsed.error, "The announcement payload is invalid.");
    }

    const announcement = await createAnnouncement({
      competitionId: parsed.data.competitionId ?? null,
      title: parsed.data.title,
      content: parsed.data.content,
      isPinned: parsed.data.isPinned ?? false,
      isPublished: parsed.data.isPublished ?? true,
      publishedAt:
        parsed.data.isPublished === false
          ? null
          : parsed.data.publishedAt ?? new Date(),
      createdById: session.user.id,
    });

    await recordAuditLog({
      request,
      user: session.user,
      action: "announcement.create",
      entityType: "announcement",
      entityId: announcement.id,
      details: {
        competitionId: announcement.competitionId,
        isPinned: announcement.isPinned,
        isPublished: announcement.isPublished,
      },
    });

    revalidateCacheTags([
      cacheTags.announcements,
      announcement.competitionId
        ? cacheTags.competition(announcement.competitionId)
        : null,
    ]);

    return apiSuccess({ announcement }, 201);
  } catch (error) {
    return mapRouteError(error);
  }
}
