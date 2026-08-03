export class ApiClientError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.details = details;
  }
}

type ApiSuccessEnvelope<T> = {
  status: "ok";
  data: T;
};

type ApiErrorEnvelope = {
  status: "error";
  message: string;
  details?: unknown;
};

// Keep client-side API consumption aligned with the shared route envelope so
// teacher/student screens can switch endpoints without rewriting fetch glue.
export async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json()) as ApiSuccessEnvelope<T> | ApiErrorEnvelope;

  if (!response.ok || payload.status === "error") {
    throw new ApiClientError(
      payload.status === "error" ? payload.message : "The request failed.",
      response.status,
      payload.status === "error" ? payload.details : undefined
    );
  }

  return payload.data;
}
