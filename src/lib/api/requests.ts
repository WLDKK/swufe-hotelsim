import type { NextRequest } from "next/server";

// Normalizing query-string handling in one place keeps route files focused on
// business rules instead of repeating trim/empty-string edge cases.
export function getOptionalSearchParam(request: NextRequest, key: string) {
  const value = request.nextUrl.searchParams.get(key);
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

export function countPresentValues(
  values: ReadonlyArray<string | null | undefined>
) {
  return values.reduce(
    (count, value) => (typeof value === "string" && value.length > 0 ? count + 1 : count),
    0
  );
}
