import type { NextAuthConfig } from "next-auth";

// Keep middleware-safe settings here. This file must stay free of Prisma and
// other Node-only imports so route protection can run in the Edge runtime.
const authConfig = {
  // Middleware still expects a complete NextAuth config shape. The real
  // provider list is supplied in `auth.ts`, but this empty array keeps the
  // shared config type-safe for Edge-only usage.
  providers: [],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // Only permit redirects that stay inside this app. This is the shared
    // low-level redirect gate; form actions still sanitize callbackUrl before
    // handing values to Auth.js.
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }

      try {
        const target = new URL(url);
        if (target.origin === baseUrl) {
          return target.toString();
        }
      } catch {
        return baseUrl;
      }

      return baseUrl;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
