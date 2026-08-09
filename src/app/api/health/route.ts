import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DATABASE_TIMEOUT_MS = 2500;

export async function GET() {
  const startedAt = Date.now();
  let database: "ready" | "unavailable" = "unavailable";

  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Database health check timed out.")), DATABASE_TIMEOUT_MS);
      }),
    ]);
    database = "ready";
  } catch (error) {
    console.error(JSON.stringify({
      message: "database health check failed",
      error: error instanceof Error ? error.message : "unknown error",
    }));
  }

  const healthy = database === "ready";
  return NextResponse.json(
    {
      status: healthy ? "ready" : "degraded",
      service: "swufe-hotelsim",
      database,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
