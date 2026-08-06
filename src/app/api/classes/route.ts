import { NextRequest } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { revalidateClassReadModels } from "@/lib/cache-invalidation";
import {
  getAccessibleClassRecord,
  getAccessibleSemesterRecord,
} from "@/lib/api/access";
import {
  countPresentValues,
  getOptionalSearchParam,
} from "@/lib/api/requests";
import {
  apiError,
  apiSuccess,
  apiValidationError,
  mapRouteError,
} from "@/lib/api/responses";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";
import {
  createClass,
  getClassById,
  getClassByJoinCode,
  listAllClasses,
  listClassesForJudge,
  listClassesForSemester,
  listClassesForTeacher,
} from "@/lib/dal/classes";
import { classCreateSchema } from "@/lib/validations/api";

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
    const classId = getOptionalSearchParam(request, "classId");
    const semesterId = getOptionalSearchParam(request, "semesterId");
    const joinCode = getOptionalSearchParam(request, "joinCode");
    const selectorCount = countPresentValues([classId, semesterId, joinCode]);

    if (selectorCount > 1) {
      return apiError(
        400,
        "Provide only one of classId, semesterId, or joinCode per request."
      );
    }

    if (classId) {
      const roleError = requireApiRoles(session.user, ["TEACHER", "ADMIN", "JUDGE"]);
      if (roleError) {
        return roleError;
      }

      const accessibleClass = await getAccessibleClassRecord(
        session.user,
        classId
      );

      if (!accessibleClass) {
        return apiError(404, "Class not found.");
      }

      const classRecord = await getClassById(classId);
      if (!classRecord) {
        return apiError(404, "Class not found.");
      }

      return apiSuccess({ class: classRecord });
    }

    if (semesterId) {
      const roleError = requireApiRoles(session.user, ["TEACHER", "ADMIN", "JUDGE"]);
      if (roleError) {
        return roleError;
      }

      const accessibleSemester = await getAccessibleSemesterRecord(
        session.user,
        semesterId
      );

      if (!accessibleSemester) {
        return apiError(404, "Semester not found.");
      }

      const classes = await listClassesForSemester(semesterId);
      return apiSuccess({ classes });
    }

    if (joinCode) {
      // Join-code lookup stays broader than ownership-based queries because the
      // later student enrollment flow needs a way to preview a class before
      // the student belongs to one of its teams.
      const classRecord = await getClassByJoinCode(joinCode);

      if (!classRecord) {
        return apiError(404, "Class not found.");
      }

      if (session.user.role === "TEACHER") {
        const accessibleSemester = await getAccessibleSemesterRecord(
          session.user,
          classRecord.semesterId
        );

        if (!accessibleSemester) {
          return apiError(404, "Class not found.");
        }
      }

      return apiSuccess({ class: classRecord });
    }

    // A bare GET is reserved for teacher/admin list screens. Student class
    // views will use team-specific APIs until the richer dashboard layer lands.
    if (session.user.role === "ADMIN") {
      const classes = await listAllClasses();
      return apiSuccess({ classes });
    }

    if (session.user.role === "TEACHER") {
      const classes = await listClassesForTeacher(session.user.id);
      return apiSuccess({ classes });
    }

    if (session.user.role === "JUDGE") {
      const classes = await listClassesForJudge(session.user.id);
      return apiSuccess({ classes });
    }

    return apiError(
      400,
      "Provide classId, semesterId, or joinCode when requesting class data."
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
    const roleError = requireApiRoles(session.user, ["TEACHER", "ADMIN"]);
    if (roleError) {
      return roleError;
    }

    const parsed = classCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiValidationError(parsed.error, "The class payload is invalid.");
    }

    const accessibleSemester = await getAccessibleSemesterRecord(
      session.user,
      parsed.data.semesterId
    );

    if (!accessibleSemester) {
      return apiError(404, "Semester not found.");
    }

    const classRecord = await createClass(parsed.data);

    await recordAuditLog({
      request,
      user: session.user,
      action: "class.create",
      entityType: "class",
      entityId: classRecord.id,
      details: {
        semesterId: classRecord.semesterId,
        name: classRecord.name,
        joinCode: classRecord.joinCode,
        maxTeams: classRecord.maxTeams,
        minTeamSize: classRecord.minTeamSize,
        maxTeamSize: classRecord.maxTeamSize,
        maxRounds: classRecord.maxRounds,
      },
    });

    revalidateClassReadModels({
      classId: classRecord.id,
      semesterId: classRecord.semesterId,
      teacherId: accessibleSemester.creatorId,
      joinCode: classRecord.joinCode,
    });

    return apiSuccess({ class: classRecord }, 201);
  } catch (error) {
    return mapRouteError(error);
  }
}
