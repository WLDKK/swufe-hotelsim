import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { apiError } from "@/lib/api/responses";

export type ApiSessionUser = Session["user"];

export async function requireApiSession() {
  const session = await auth();

  if (!session?.user) {
    return {
      response: apiError(401, "Authentication is required."),
    } as const;
  }

  return { session } as const;
}

export function requireApiRoles(
  user: ApiSessionUser,
  allowedRoles: ReadonlyArray<ApiSessionUser["role"]>
) {
  if (!allowedRoles.includes(user.role)) {
    return apiError(403, "You do not have permission to access this resource.");
  }

  return null;
}
