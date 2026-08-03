"use server";

import { signOut } from "@/lib/auth";

export async function signOutAction() {
  // Keep logout server-driven so the session cookie is cleared by the same
  // Auth.js entrypoint that created it, while still allowing client shells to
  // reference a standalone server action during production builds.
  await signOut({ redirectTo: "/login" });
}
