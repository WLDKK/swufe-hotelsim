import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { hashPassword } from "@/lib/auth/passwords";
import { recordAuditLog } from "@/lib/audit";
import { revalidateUserReadModels } from "@/lib/cache-invalidation";
import { getOptionalSearchParam } from "@/lib/api/requests";
import {
  apiError,
  apiSuccess,
  apiValidationError,
  mapRouteError,
} from "@/lib/api/responses";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";
import {
  createUser,
  getUserAdminSummaryById,
  getUserByStudentId,
  getUserForCredentials,
  listPlatformUsers,
  updateUserRole,
} from "@/lib/dal/users";
import {
  adminUserCreateSchema,
  adminUserRoleUpdateSchema,
} from "@/lib/validations/api";

export const dynamic = "force-dynamic";

function parseRoleFilter(roleValue: string | null) {
  if (!roleValue) {
    return null;
  }

  return Object.values(UserRole).includes(roleValue as UserRole)
    ? (roleValue as UserRole)
    : null;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireApiSession();
    if ("response" in authResult) {
      return authResult.response;
    }

    const { session } = authResult;
    const roleError = requireApiRoles(session.user, ["ADMIN"]);
    if (roleError) {
      return roleError;
    }

    const roleParam = getOptionalSearchParam(request, "role");
    const search = getOptionalSearchParam(request, "search");
    const role = parseRoleFilter(roleParam);

    if (roleParam && !role) {
      return apiError(400, "The requested user role filter is invalid.");
    }

    const users = await listPlatformUsers({
      role: role ?? undefined,
      search: search ?? undefined,
    });

    return apiSuccess({ users });
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
    const roleError = requireApiRoles(session.user, ["ADMIN"]);
    if (roleError) {
      return roleError;
    }

    const parsed = adminUserCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiValidationError(parsed.error, "The user payload is invalid.");
    }

    const existingUser = await getUserForCredentials(parsed.data.email);
    if (existingUser) {
      return apiError(409, "That email is already registered.");
    }

    if (parsed.data.studentId) {
      const existingStudentId = await getUserByStudentId(parsed.data.studentId);
      if (existingStudentId) {
        return apiError(409, "That student ID is already in use.");
      }
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await createUser({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
      studentId: parsed.data.studentId,
      emailVerified: new Date(),
    });

    await recordAuditLog({
      request,
      user: session.user,
      action: "user.create",
      entityType: "user",
      entityId: user.id,
      details: {
        email: user.email,
        role: user.role,
        studentId: user.studentId,
      },
    });

    revalidateUserReadModels([user.id]);

    return apiSuccess({ user }, 201);
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireApiSession();
    if ("response" in authResult) {
      return authResult.response;
    }

    const { session } = authResult;
    const roleError = requireApiRoles(session.user, ["ADMIN"]);
    if (roleError) {
      return roleError;
    }

    const parsed = adminUserRoleUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiValidationError(
        parsed.error,
        "The user role update payload is invalid."
      );
    }

    const targetUser = await getUserAdminSummaryById(parsed.data.userId);
    if (!targetUser) {
      return apiError(404, "User not found.");
    }

    if (targetUser.id === session.user.id && parsed.data.role !== "ADMIN") {
      return apiError(400, "You cannot remove your own admin role.");
    }

    const user = await updateUserRole(parsed.data.userId, parsed.data.role);

    await recordAuditLog({
      request,
      user: session.user,
      action: "user.role.update",
      entityType: "user",
      entityId: user.id,
      details: {
        email: targetUser.email,
        previousRole: targetUser.role,
        nextRole: user.role,
      },
    });

    revalidateUserReadModels([user.id]);

    return apiSuccess({ user });
  } catch (error) {
    return mapRouteError(error);
  }
}
