import type { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDefaultDashboardPath } from "@/lib/auth/routing";

export async function requireRoleSession(allowedRoles: ReadonlyArray<UserRole>) {
  // This helper is the server-component counterpart to middleware. Middleware
  // handles navigation-time redirects, while this function protects layouts and
  // pages during direct server rendering.
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!allowedRoles.includes(session.user.role)) {
    redirect(getDefaultDashboardPath(session.user.role));
  }

  return session;
}
