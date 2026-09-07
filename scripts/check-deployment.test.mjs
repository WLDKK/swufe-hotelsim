import test from "node:test";
import assert from "node:assert/strict";
import { checkDeployment } from "./check-deployment.mjs";

function mockFetch({ callbackOrigin = "https://hotel.example", status = 200, missingProvider = false, wrongPage = false } = {}) {
  return async (url) => {
    if (url.pathname === "/api/auth/providers") {
      return Response.json(missingProvider ? {} : { credentials: {
        type: "credentials",
        signinUrl: "https://hotel.example/api/auth/signin/credentials",
        callbackUrl: `${callbackOrigin}/api/auth/callback/credentials`,
      } });
    }
    if (url.pathname === "/api/auth/session") return Response.json(null);
    return new Response(wrongPage ? "Unrelated site" : "<title>SWUFE HotelSim</title>", { status });
  };
}

test("accepts healthy public pages and same-origin auth endpoints", async () => {
  assert.deepEqual(await checkDeployment("https://hotel.example", mockFetch()), [
    "/: OK", "/login: OK", "/api/auth/providers: OK", "/api/auth/session: OK",
  ]);
});
test("rejects an auth callback pointing to a different website", async () => {
  await assert.rejects(checkDeployment("https://hotel.example", mockFetch({ callbackOrigin: "https://portfolio.example" })), /callbackUrl points to/);
});
test("rejects a platform error response", async () => {
  await assert.rejects(checkDeployment("https://hotel.example", mockFetch({ status: 503 })), /received 503/);
});
test("rejects a missing credentials provider", async () => {
  await assert.rejects(checkDeployment("https://hotel.example", mockFetch({ missingProvider: true })), /provider is missing/);
});
test("rejects an unrelated website that returns HTTP 200", async () => {
  await assert.rejects(checkDeployment("https://hotel.example", mockFetch({ wrongPage: true })), /not a HotelSim page/);
});
test("reports HTML masquerading as a providers response", async () => {
  const fetcher = mockFetch();
  await assert.rejects(checkDeployment("https://hotel.example", (url) => url.pathname === "/api/auth/providers"
    ? new Response("<html>Error</html>") : fetcher(url)), /\/api\/auth\/providers: expected JSON/);
});
test("reports a missing callback URL", async () => {
  const fetcher = mockFetch();
  await assert.rejects(checkDeployment("https://hotel.example", (url) => url.pathname === "/api/auth/providers"
    ? Response.json({ credentials: { type: "credentials", signinUrl: "https://hotel.example/signin" } }) : fetcher(url)), /callbackUrl is missing/);
});
