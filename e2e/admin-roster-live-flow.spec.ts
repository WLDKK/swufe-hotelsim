import { expect, test } from "@playwright/test";
import {
  getFirstNonPlaceholderOptionValue,
  loginAs,
  readRoundProgress,
  signOut,
  waitForHealthyPage,
} from "./helpers";

const mutationEnabled = process.env.E2E_ALLOW_MUTATION === "true";
const freshSeedExpected = process.env.E2E_EXPECT_FRESH_SEED === "true";
const classBLabel = "Hotel Simulation Class B";

const rosterCsv = [
  "team_name,hotel_name,team_color,student_email,student_id,student_name,team_role",
  "Team Cedar,Cedar Riverside Hotel,#8B1A1A,student13@hotelsim.example,2026HS13,,LEADER",
  "Team Cedar,Cedar Riverside Hotel,#8B1A1A,student14@hotelsim.example,2026HS14,,MEMBER",
  "Team Cedar,Cedar Riverside Hotel,#8B1A1A,student15@hotelsim.example,2026HS15,,MEMBER",
  "Team Maple,Maple Convention Hotel,#1B3A5C,student16@hotelsim.example,2026HS16,,LEADER",
  "Team Maple,Maple Convention Hotel,#1B3A5C,student11@hotelsim.example,2026HS11,,MEMBER",
  "Team Maple,Maple Convention Hotel,#1B3A5C,student12@hotelsim.example,2026HS12,,MEMBER",
].join("\r\n");

test.describe("disposable admin roster mutation flow", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(10 * 60 * 1000);
  test.skip(
    !mutationEnabled || !freshSeedExpected,
    "Set E2E_ALLOW_MUTATION=true and E2E_EXPECT_FRESH_SEED=true before running this disposable roster flow."
  );

  // This spec assumes a freshly seeded disposable database where Class B is
  // still a setup-only class. It intentionally mutates roster state, then
  // verifies the setup gate locks once round processing begins.
  test("admin csv import + interactive roster edits + teacher initialize + admin lock", async ({
    browser,
  }) => {
    let classBId = "";

    await test.step("Admin imports a setup roster into Class B from CSV", async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await loginAs(page, "admin@hotelsim.example", "/admin/dashboard");
      await page.goto("/admin/classes");
      await waitForHealthyPage(page, /Cross-semester class management/i);

      const classCard = page.locator(
        `[data-testid="admin-class-card"][data-class-name="${classBLabel}"]`
      );
      // The admin classes page hydrates from live semester and class queries,
      // so on a remote disposable Supabase run we wait for the seeded card to
      // actually appear instead of assuming it renders within the default expect window.
      await expect
        .poll(
          async () => classCard.count(),
          {
            timeout: 20_000,
            message: "Waiting for the admin classes directory to render Class B.",
          }
        )
        .toBeGreaterThan(0);
      await expect(classCard).toBeVisible();

      const detailLink = classCard.getByRole("link", { name: "Open class detail" });
      const href = await detailLink.getAttribute("href");
      classBId = href?.split("/").pop() ?? "";
      if (!classBId) {
        throw new Error(`Could not resolve the class id for ${classBLabel}.`);
      }

      await detailLink.click();
      await waitForHealthyPage(page, /Admin oversight for/i, 8);
      await expect(
        page.getByRole("heading", { name: new RegExp(classBLabel, "i") })
      ).toBeVisible();
      await expect(page.getByText("Setup open", { exact: true }).first()).toBeVisible();

      await page.locator("#admin-roster-csv-file").setInputFiles({
        name: "class-b-roster.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(rosterCsv),
      });

      await page.getByRole("button", { name: "Validate CSV" }).click();
      await expect(
        page.getByText(
          "Roster CSV validation passed. Review the preview summary before applying it."
        )
      ).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText("Team Cedar")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText("Team Maple")).toBeVisible({ timeout: 20_000 });

      await page.getByRole("button", { name: "Apply CSV to class" }).click();
      // Applying CSV returns before the parent class-detail query has always
      // finished refetching on the remote environment, so treat the success
      // banner plus team-card count as the real completion signal.
      await expect(
        page.getByText(/Roster CSV applied successfully\./i)
      ).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('[data-testid="admin-team-card"]')).toHaveCount(2, {
        timeout: 20_000,
      });
      await expect(
        page.locator('[data-testid="admin-team-card"][data-team-name="Team Cedar"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="admin-team-card"][data-team-name="Team Maple"]')
      ).toBeVisible();

      await signOut(page);
      await context.close();
    });

    await test.step("Admin creates and then deletes a setup-only team interactively", async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await loginAs(page, "admin@hotelsim.example", "/admin/dashboard");
      await page.goto(`/admin/classes/${classBId}`);
      await waitForHealthyPage(page, /Admin oversight for/i, 8);

      const createForm = page.getByTestId("admin-create-team-form");
      await createForm.getByLabel("Team name").fill("Team Redwood");
      await createForm.getByLabel("Hotel name").fill("Redwood Skyline Hotel");

      const leaderUserId = await getFirstNonPlaceholderOptionValue(
        page,
        "admin-team-leader"
      );
      await createForm.getByLabel("Leader").selectOption(leaderUserId);

      const memberCheckboxes = createForm.locator('input[name="memberUserIds"]');
      await expect
        .poll(
          async () => memberCheckboxes.count(),
          {
            timeout: 15_000,
            message: "Waiting for at least two selectable member checkboxes.",
          }
        )
        .toBeGreaterThanOrEqual(2);
      await memberCheckboxes.nth(0).check();
      await memberCheckboxes.nth(1).check();

      await createForm.getByRole("button", { name: "Create team" }).click();
      await expect(
        page.getByText(
          "The new team has been created and synced into the live class roster."
        )
      ).toBeVisible({ timeout: 20_000 });

      const redwoodCard = page.locator(
        '[data-testid="admin-team-card"][data-team-name="Team Redwood"]'
      );
      await expect(redwoodCard).toBeVisible();

      await redwoodCard.getByRole("button", { name: "Delete team" }).click();
      await expect(
        page.getByText(
          "The team was deleted from the setup roster and class detail has been refreshed."
        )
      ).toBeVisible({ timeout: 20_000 });
      await expect(redwoodCard).toHaveCount(0, { timeout: 20_000 });

      await signOut(page);
      await context.close();
    });

    await test.step("Teacher initializes Class B into round 1", async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await loginAs(page, "teacher@hotelsim.example", "/teacher/dashboard");
      await page.goto(`/teacher/classes/${classBId}`);
      await waitForHealthyPage(page, /Live class control for/i, 8);
      await expect(
        page.getByRole("heading", { name: new RegExp(classBLabel, "i") })
      ).toBeVisible();
      await expect(await readRoundProgress(page)).toMatchObject({ current: 0 });

      await page.getByRole("button", { name: "Initialize round 1" }).click();
      await expect
        .poll(
          async () => {
            await page.reload();
            await waitForHealthyPage(page, /Live class control for/i, 8);
            return (await readRoundProgress(page)).current;
          },
          {
            timeout: 30_000,
            message: "Waiting for Class B to enter round 1 after initialization.",
          }
        )
        .toBe(1);

      await signOut(page);
      await context.close();
    });

    await test.step("Admin sees setup-only roster actions lock after initialization", async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await loginAs(page, "admin@hotelsim.example", "/admin/dashboard");
      await page.goto(`/admin/classes/${classBId}`);
      await waitForHealthyPage(page, /Admin oversight for/i, 8);

      await expect(
        page.getByText("Locked after round start", { exact: true }).first()
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Apply CSV to class" })
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Create team" })
      ).toBeDisabled();

      await signOut(page);
      await context.close();
    });
  });
});
