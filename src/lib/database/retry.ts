import { Prisma } from "@prisma/client";

const READ_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

const RETRYABLE_DATABASE_MESSAGE_PATTERNS = [
  "can't reach database server",
  "connection terminated unexpectedly",
  "terminating connection",
  "connection closed",
  "server has closed the connection",
  "socket hang up",
  "timed out",
  "timeout",
  "too many clients already",
];

export function isRetryableDatabaseError(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return RETRYABLE_DATABASE_MESSAGE_PATTERNS.some((pattern) =>
    message.includes(pattern)
  );
}

export function shouldRetryDatabaseOperation(operation: string) {
  return READ_OPERATIONS.has(operation);
}

export function getDatabaseReadRetryConfig() {
  const attempts = Number(process.env.PRISMA_READ_RETRY_ATTEMPTS ?? "3");
  const baseDelayMs = Number(process.env.PRISMA_READ_RETRY_DELAY_MS ?? "250");

  return {
    attempts: Number.isFinite(attempts) ? Math.max(1, Math.trunc(attempts)) : 3,
    baseDelayMs: Number.isFinite(baseDelayMs)
      ? Math.max(0, Math.trunc(baseDelayMs))
      : 250,
  };
}

export async function waitForRetryDelay(delayMs: number) {
  await new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}
