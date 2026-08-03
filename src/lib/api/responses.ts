import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import type { ZodError } from "zod";

// Keep route payloads consistent so page hooks and later frontend state layers
// do not need custom parsing rules for each endpoint.
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(
    {
      status: "ok",
      data,
    },
    { status }
  );
}

export function apiError(status: number, message: string, details?: unknown) {
  return NextResponse.json(
    {
      status: "error",
      message,
      ...(details === undefined ? {} : { details }),
    },
    { status }
  );
}

export function apiValidationError(
  error: ZodError,
  message = "The request payload failed validation."
) {
  const flattened = error.flatten();

  return apiError(400, message, {
    fieldErrors: flattened.fieldErrors,
    formErrors: flattened.formErrors,
  });
}

export function mapRouteError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return apiError(409, "A unique constraint was violated.", {
        target: error.meta?.target ?? null,
      });
    }

    if (error.code === "P2025") {
      return apiError(404, "The requested record was not found.");
    }
  }

  if (error instanceof SyntaxError) {
    return apiError(400, "The request body is not valid JSON.");
  }

  console.error(error);
  return apiError(500, "An unexpected server error occurred.");
}
