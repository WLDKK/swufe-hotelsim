import { PrismaClient } from "@prisma/client";
import {
  getDatabaseReadRetryConfig,
  isRetryableDatabaseError,
  shouldRetryDatabaseOperation,
  waitForRetryDelay,
} from "@/lib/database/retry";

function createPrismaClient() {
  const baseClient = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
  const retryConfig = getDatabaseReadRetryConfig();

  return baseClient.$extends({
    query: {
      $allModels: {
        // Supabase pooler hiccups mostly surface on read-heavy dashboard loads.
        // Retry those read operations centrally so route handlers and DAL files
        // do not each invent their own connectivity-recovery loop.
        async $allOperations({ operation, args, query }) {
          if (
            retryConfig.attempts <= 1 ||
            !shouldRetryDatabaseOperation(operation)
          ) {
            return query(args);
          }

          for (let attempt = 1; attempt <= retryConfig.attempts; attempt += 1) {
            try {
              return await query(args);
            } catch (error) {
              const canRetry =
                attempt < retryConfig.attempts && isRetryableDatabaseError(error);

              if (!canRetry) {
                throw error;
              }

              if (process.env.NODE_ENV !== "test") {
                console.warn(
                  `Retrying Prisma ${operation} after transient database error (attempt ${attempt + 1}/${retryConfig.attempts}).`
                );
              }

              await waitForRetryDelay(retryConfig.baseDelayMs * attempt);
            }
          }

          return query(args);
        },
      },
    },
  });
}

type PrismaClientWithReadRetry = ReturnType<typeof createPrismaClient>;

// A shared singleton prevents exhausting database connections during local
// hot reloads and gives DAL, auth, API routes, and background jobs a stable
// import path. Keep the singleton typed to the extended client shape so
// interactive transactions and read retries stay available everywhere.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientWithReadRetry | undefined;
};

export const prisma: PrismaClientWithReadRetry =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
