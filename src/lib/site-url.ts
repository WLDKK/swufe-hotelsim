const LOCALHOST_APP_URL = "http://localhost:3000";

function normalizeBaseUrlCandidate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function getAppBaseUrl() {
  return (
    normalizeBaseUrlCandidate(process.env.NEXTAUTH_URL) ||
    normalizeBaseUrlCandidate(process.env.AUTH_URL) ||
    normalizeBaseUrlCandidate(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeBaseUrlCandidate(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    LOCALHOST_APP_URL
  );
}

export function toAbsoluteAppUrl(path: string) {
  try {
    return new URL(path, `${getAppBaseUrl()}/`).toString();
  } catch {
    return path;
  }
}
