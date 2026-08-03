export const APP_ROLES = ["STUDENT", "TEACHER", "JUDGE", "SPECTATOR", "ADMIN"] as const;

export type AppRole = (typeof APP_ROLES)[number];

const roleDashboardMap: Record<AppRole, string> = {
  STUDENT: "/student/dashboard",
  TEACHER: "/teacher/dashboard",
  JUDGE: "/judge/dashboard",
  SPECTATOR: "/display",
  ADMIN: "/admin/dashboard",
};

export function getDefaultDashboardPath(role?: string | null) {
  // Default to the student workspace for unknown values so callers always get
  // a valid internal route, even during partial session states.
  if (role === "TEACHER") {
    return roleDashboardMap.TEACHER;
  }

  if (role === "ADMIN") {
    return roleDashboardMap.ADMIN;
  }

  if (role === "JUDGE") {
    return roleDashboardMap.JUDGE;
  }

  if (role === "SPECTATOR") {
    return roleDashboardMap.SPECTATOR;
  }

  return roleDashboardMap.STUDENT;
}

export function isAuthRoute(pathname: string) {
  return pathname === "/login" || pathname === "/register";
}

export function isProtectedAppRoute(pathname: string) {
  // Keep this helper coarse-grained. Middleware only needs to know whether a
  // request enters one of the protected role areas, not which exact page it is.
  return (
    pathname.startsWith("/student") ||
    pathname.startsWith("/teacher") ||
    pathname.startsWith("/judge") ||
    pathname.startsWith("/admin")
  );
}

export function isRoleAllowedForPath(pathname: string, role?: string | null) {
  if (!role) {
    return false;
  }

  // These checks intentionally follow path prefixes instead of more complex
  // route metadata so Stage 2 stays easy to audit and update.
  if (pathname.startsWith("/student")) {
    return role === "STUDENT";
  }

  if (pathname.startsWith("/teacher")) {
    return role === "TEACHER";
  }

  if (pathname.startsWith("/judge")) {
    return role === "JUDGE";
  }

  if (pathname.startsWith("/admin")) {
    return role === "ADMIN";
  }

  return true;
}

// Only allow internal relative redirects. Business pages can pass callbackUrl
// through login safely without creating an open-redirect hole.
export function sanitizeCallbackUrl(candidate?: string | null) {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return null;
  }

  if (isAuthRoute(candidate)) {
    return null;
  }

  return candidate;
}
