import { NextRequest } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { revalidateSemesterReadModels } from "@/lib/cache-invalidation";
import { getAccessibleSemesterRecord } from "@/lib/api/access";
import { getOptionalSearchParam } from "@/lib/api/requests";
import {
  apiError,
  apiSuccess,
  apiValidationError,
  mapRouteError,
} from "@/lib/api/responses";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";
import {
  createSemester,
  getSemesterById,
  listAllSemesters,
  listSemestersForTeacher,
} from "@/lib/dal/semesters";
import { getUserAdminSummaryById } from "@/lib/dal/users";
import { semesterCreateSchema } from "@/lib/validations/api";

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
    const roleError = requireApiRoles(session.user, ["TEACHER", "ADMIN", "JUDGE"]);
    if (roleError) {
      return roleError;
    }

    const semesterId = getOptionalSearchParam(request, "semesterId");

    // This endpoint supports two teacher/admin workflows:
    // 1. list accessible semesters for dashboard tables
    // 2. fetch one semester with nested class data for detail pages
    if (semesterId) {
      const accessibleSemester = await getAccessibleSemesterRecord(
        session.user,
        semesterId
      );

      if (!accessibleSemester) {
        return apiError(404, "Semester not found.");
      }

      const semester = await getSemesterById(semesterId);
      if (!semester) {
        return apiError(404, "Semester not found.");
      }

      return apiSuccess({ semester });
    }

    const semesters =
      session.user.role === "ADMIN" || session.user.role === "JUDGE"
        ? await listAllSemesters()
        : await listSemestersForTeacher(session.user.id);

    return apiSuccess({ semesters });
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

    const parsed = semesterCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiValidationError(parsed.error, "The semester payload is invalid.");
    }

    let creatorId = session.user.id;

    // Admin users can assign a semester to a teacher so the downstream teacher
    // workspace can immediately see and operate the new semester. Teachers
    // themselves stay restricted to creating under their own ownership.
    if (session.user.role === "ADMIN" && parsed.data.creatorId) {
      const requestedCreator = await getUserAdminSummaryById(parsed.data.creatorId);

      if (!requestedCreator) {
        return apiError(404, "The selected semester owner was not found.");
      }

      if (!["TEACHER", "ADMIN"].includes(requestedCreator.role)) {
        return apiError(
          400,
          "Semesters can only be assigned to teacher or admin accounts."
        );
      }

      creatorId = requestedCreator.id;
    } else if (
      session.user.role === "TEACHER" &&
      parsed.data.creatorId &&
      parsed.data.creatorId !== session.user.id
    ) {
      return apiError(403, "Teachers can only create semesters for themselves.");
    }

    const semester = await createSemester({
      creatorId,
      name: parsed.data.name,
      code: parsed.data.code,
      description: parsed.data.description,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
    });

    await recordAuditLog({
      request,
      user: session.user,
      action: "semester.create",
      entityType: "semester",
      entityId: semester.id,
      details: {
        creatorId: semester.creatorId,
        name: semester.name,
        code: semester.code,
        status: semester.status,
      },
    });

    revalidateSemesterReadModels({
      semesterId: semester.id,
      teacherId: semester.creatorId,
    });

    return apiSuccess({ semester }, 201);
  } catch (error) {
    return mapRouteError(error);
  }
}
