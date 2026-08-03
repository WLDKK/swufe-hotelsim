import type { DefaultSession } from "next-auth";

// Extend Auth.js types once so the rest of the app can rely on strongly typed
// role/session metadata instead of repeating local casts everywhere.
declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: "STUDENT" | "TEACHER" | "JUDGE" | "SPECTATOR" | "ADMIN";
      studentId: string | null;
      locale: "ZH_CN" | "EN_US";
    };
  }

  interface User {
    role: "STUDENT" | "TEACHER" | "JUDGE" | "SPECTATOR" | "ADMIN";
    studentId?: string | null;
    locale: "ZH_CN" | "EN_US";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "STUDENT" | "TEACHER" | "JUDGE" | "SPECTATOR" | "ADMIN";
    studentId?: string | null;
    locale?: "ZH_CN" | "EN_US";
  }
}
