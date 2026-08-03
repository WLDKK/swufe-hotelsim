import { describe, expect, it } from "vitest";
import {
  getDatabaseReadRetryConfig,
  isRetryableDatabaseError,
  shouldRetryDatabaseOperation,
} from "./retry";

describe("database retry helpers", () => {
  it("recognizes retryable pooler-style connectivity errors", () => {
    expect(
      isRetryableDatabaseError(
        new Error(
          "Can't reach database server at `aws-1-ap-northeast-2.pooler.supabase.com:5432`."
        )
      )
    ).toBe(true);

    expect(
      isRetryableDatabaseError(
        new Error("The connection terminated unexpectedly while reading rows.")
      )
    ).toBe(true);
  });

  it("does not retry non-connectivity application errors", () => {
    expect(
      isRetryableDatabaseError(new Error("A unique constraint was violated."))
    ).toBe(false);
  });

  it("retries read operations but not writes", () => {
    expect(shouldRetryDatabaseOperation("findMany")).toBe(true);
    expect(shouldRetryDatabaseOperation("count")).toBe(true);
    expect(shouldRetryDatabaseOperation("create")).toBe(false);
    expect(shouldRetryDatabaseOperation("update")).toBe(false);
  });

  it("normalizes retry config from the environment", () => {
    const originalAttempts = process.env.PRISMA_READ_RETRY_ATTEMPTS;
    const originalDelay = process.env.PRISMA_READ_RETRY_DELAY_MS;

    process.env.PRISMA_READ_RETRY_ATTEMPTS = "4";
    process.env.PRISMA_READ_RETRY_DELAY_MS = "125";

    expect(getDatabaseReadRetryConfig()).toEqual({
      attempts: 4,
      baseDelayMs: 125,
    });

    process.env.PRISMA_READ_RETRY_ATTEMPTS = originalAttempts;
    process.env.PRISMA_READ_RETRY_DELAY_MS = originalDelay;
  });
});
