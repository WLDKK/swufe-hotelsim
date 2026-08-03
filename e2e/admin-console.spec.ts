import { expect, test } from "@playwright/test";
import { loginAs, signOut, waitForHealthyPage } from "./helpers";

test("admin can traverse the full control plane including roster management", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Keep this spec read-only so it can run regularly against the shared
  // Supabase dataset without changing roster, class, or user state.
  await loginAs(page, "admin@hotelsim.example", "/admin/dashboard");
  await waitForHealthyPage(
    page,
    /Platform oversight across users, semesters, and live classes/i
  );

  await page.goto("/admin/users");
  await waitForHealthyPage(page, /Platform user provisioning and role control/i);
  await expect(
    page.getByRole("heading", { name: /User directory/i })
  ).toBeVisible();
  await expect(page.getByLabel("Role", { exact: true })).toBeVisible();

  await page.goto("/admin/semesters");
  await waitForHealthyPage(page, /Semester ownership and teaching windows/i);
  await expect(
    page.getByRole("heading", { name: /Create semester/i })
  ).toBeVisible();
  await expect(page.locator("#admin-semester-owner")).toBeVisible();

  await page.goto("/admin/classes");
  await waitForHealthyPage(page, /Cross-semester class management/i);
  await expect(
    page.getByRole("heading", { name: /Create class/i })
  ).toBeVisible();

  await expect
    .poll(
      async () => page.getByRole("link", { name: "Open class detail" }).count(),
      {
        timeout: 15_000,
        message: "Waiting for the admin classes list to render class detail links.",
      }
    )
    .toBeGreaterThan(0);

  const classDetailLink = page.getByRole("link", { name: "Open class detail" }).first();
  await classDetailLink.click();

  await waitForHealthyPage(page, /Admin oversight for/i);
  await expect(
    page.getByRole("heading", { name: /Class operations/i })
  ).toBeVisible();
  await expect(page.getByTestId("admin-team-roster-manager")).toBeVisible();
  await expect(page.getByTestId("admin-create-team-form")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Setup guardrails/i })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Bulk CSV roster workspace/i })
  ).toBeVisible();

  await signOut(page);
  await context.close();
});
