import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { cache } from "react";
import {
  getDatabaseReadRetryConfig,
  isRetryableDatabaseError,
  shouldRetryDatabaseOperation,
  waitForRetryDelay,
} from "@/lib/database/retry";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to initialize Prisma.");
  }

  const adapter = new PrismaPg({ connectionString, maxUses: 1 });
  const baseClient = new PrismaClient({
    adapter,
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

// React cache scopes the client to one server request. This is safe for both
// long-lived Node processes and Cloudflare isolates, where reusing a database
// client across requests can retain request-bound I/O state.
export const getPrisma = cache(createPrismaClient);

export const prisma = new Proxy({} as PrismaClientWithReadRetry, {
  get(_target, property) {
    const client = getPrisma();
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export default prisma;
