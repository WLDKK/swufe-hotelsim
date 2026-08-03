import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "./auth.config";
import {
  getDefaultDashboardPath,
  isAuthRoute,
  isProtectedAppRoute,
  isRoleAllowedForPath,
} from "./src/lib/auth/routing";

const { auth } = NextAuth(authConfig);

export default auth((request) => {
  const { pathname, search } = request.nextUrl;
  const session = request.auth;
  const role = session?.user?.role;

  // Logged-in users should not stay on auth entry pages unless they explicitly
  // sign out first. Send them straight to the role's default workspace.
  if (isAuthRoute(pathname) && role) {
    return NextResponse.redirect(
      new URL(getDefaultDashboardPath(role), request.nextUrl)
    );
  }

  // Non-protected routes can continue untouched. Middleware only owns auth
  // entry pages plus the role-based application areas.
  if (!isProtectedAppRoute(pathname)) {
    return NextResponse.next();
  }

  // Preserve the originally requested path so login can bounce the user back
  // to the intended screen once credentials are accepted.
  if (!role) {
    const loginUrl = new URL("/login", request.nextUrl);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  // Role-to-route matching is kept strict for now:
  // - students -> /student/*
  // - teachers -> /teacher/*
  // - judges -> /judge/*
  // - admins -> /admin/*
  // If the business decides admins may inspect other areas later, change the
  // helper in `src/lib/auth/routing.ts` rather than duplicating logic here.
  if (!isRoleAllowedForPath(pathname, role)) {
    return NextResponse.redirect(
      new URL(getDefaultDashboardPath(role), request.nextUrl)
    );
  }

  return NextResponse.next();
});

export const config = {
  // Keep the matcher narrow so auth middleware does not run for unrelated
  // assets, APIs, or public pages.
  matcher: [
    "/login",
    "/register",
    "/student/:path*",
    "/teacher/:path*",
    "/judge/:path*",
    "/admin/:path*",
  ],
};
