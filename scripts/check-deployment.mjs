import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

async function readJson(response, path) {
  try {
    return await response.json();
  } catch {
    throw new Error(`${path}: expected JSON; check for an HTML error page or a wrong domain`);
  }
}

/** Read-only checks; this does not sign in, create users, or write application data. */
export async function checkDeployment(base, fetcher = fetch) {
  const origin = new URL(base).origin;
  const results = [];
  for (const path of ["/", "/login", "/api/auth/providers", "/api/auth/session"]) {
    const response = await fetcher(new URL(path, origin), {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      headers: { Accept: path.startsWith("/api/") ? "application/json" : "text/html" },
    });
    if (response.status !== 200) {
      throw new Error(`${path}: expected HTTP 200, received ${response.status}`);
    }
    if (path === "/api/auth/providers") {
      const providers = await readJson(response, path);
      const credentials = providers?.credentials;
      if (!credentials || credentials.type !== "credentials") {
        throw new Error(`${path}: credentials provider is missing`);
      }
      for (const key of ["signinUrl", "callbackUrl"]) {
        let target;
        try {
          if (typeof credentials[key] !== "string") throw new Error("Missing URL");
          target = new URL(credentials[key]);
        } catch {
          throw new Error(`${path}: ${key} is missing or is not an absolute URL`);
        }
        if (target.origin !== origin) {
          throw new Error(`${path}: ${key} points to ${target.origin}, expected ${origin}. Check AUTH_URL and NEXTAUTH_URL.`);
        }
      }
    } else if (path === "/api/auth/session") {
      const session = await readJson(response, path);
      if (session !== null && (typeof session !== "object" || Array.isArray(session))) {
        throw new Error(`${path}: unexpected session response`);
      }
    } else {
      const html = await response.text();
      if (!html.includes("SWUFE HotelSim")) {
        throw new Error(`${path}: response is not a HotelSim page`);
      }
    }
    results.push(`${path}: OK`);
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2]) {
    console.error("Usage: node scripts/check-deployment.mjs https://your-canonical-hotel-domain");
    process.exitCode = 2;
  } else {
    try {
      for (const result of await checkDeployment(process.argv[2])) console.log(result);
      console.log("Public endpoint checks passed. Database-backed sign-in and gameplay were not tested.");
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
