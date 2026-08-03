import { expect, test } from "@playwright/test";
import {
  DEMO_PASSWORD,
  getSelectOptionValue,
  loginAs,
  signOut,
  waitForHealthyPage,
} from "./helpers";

const mutationEnabled = process.env.E2E_ALLOW_MUTATION === "true";
const freshSeedExpected = process.env.E2E_EXPECT_FRESH_SEED === "true";

test.describe("disposable admin governance mutation flow", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(10 * 60 * 1000);
  test.skip(
    !mutationEnabled || !freshSeedExpected,
    "Set E2E_ALLOW_MUTATION=true and E2E_EXPECT_FRESH_SEED=true before running this disposable governance flow."
  );

  test("admin provisions a teacher-owned semester and class that the teacher can immediately access", async ({
    browser,
  }) => {
    const stamp = Date.now();
    const teacherName = `Disposable Teacher ${stamp}`;
    const teacherEmail = `disposable-teacher-${stamp}@hotelsim.example`;
    const semesterName = `Disposable Governance Semester ${stamp}`;
    const semesterCode = `DG-${String(stamp).slice(-6)}`;
    const className = `Disposable Governance Class ${stamp}`;
    const joinCode = `DG${String(stamp).slice(-6)}`;

    await test.step("Admin creates a new teacher account", async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await loginAs(page, "admin@hotelsim.example", "/admin/dashboard");
      await page.goto("/admin/users");
      await waitForHealthyPage(page, /Platform user provisioning and role control/i);

      await page.locator("#admin-user-name").fill(teacherName);
      await page.locator("#admin-user-email").fill(teacherEmail);
      await page.locator("#admin-user-password").fill(DEMO_PASSWORD);
      await page.locator("#admin-user-role").selectOption("TEACHER");
      await page.getByRole("button", { name: "Create user" }).click();

      await expect(
        page.getByText("The new user has been created and can sign in immediately.")
      ).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(teacherEmail).first()).toBeVisible({ timeout: 20_000 });

      await signOut(page);
      await context.close();
    });

    await test.step("Admin assigns a new semester to that teacher", async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await loginAs(page, "admin@hotelsim.example", "/admin/dashboard");
      await page.goto("/admin/semesters");
      await waitForHealthyPage(page, /Semester ownership and teaching windows/i);

      const ownerValue = await getSelectOptionValue(
        page,
        "admin-semester-owner",
        teacherName
      );
      await page.locator("#admin-semester-owner").selectOption(ownerValue);
      await page.locator("#admin-semester-name").fill(semesterName);
      await page.locator("#admin-semester-code").fill(semesterCode);
      await page.locator("#admin-semester-description").fill(
        "Disposable governance-flow semester created during Stage 4 acceptance."
      );
      await page.locator("#admin-semester-start").fill("2026-03-01");
      await page.locator("#admin-semester-end").fill("2026-06-30");
      await page.getByRole("button", { name: "Create semester" }).click();

      await expect(page.getByText(semesterName).first()).toBeVisible({ timeout: 20_000 });

      await signOut(page);
      await context.close();
    });

    await test.step("Admin creates a class inside the new teacher-owned semester", async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await loginAs(page, "admin@hotelsim.example", "/admin/dashboard");
      await page.goto("/admin/classes");
      await waitForHealthyPage(page, /Cross-semester class management/i);

      const semesterValue = await getSelectOptionValue(
        page,
        "admin-class-semester",
        semesterName
      );
      await page.locator("#admin-class-semester").selectOption(semesterValue);
      await page.locator("#admin-class-name").fill(className);
      await page.locator("#admin-class-join-code").fill(joinCode);
      await page.locator("#admin-class-max-teams").fill("6");
      await page.getByRole("button", { name: "Create" }).click();

      const classCard = page.locator(
        `[data-testid="admin-class-card"][data-class-name="${className}"]`
      );
      await expect(classCard).toBeVisible({ timeout: 20_000 });

      await signOut(page);
      await context.close();
    });

    await test.step("The new teacher sees the semester and class in the live workspace", async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await loginAs(page, teacherEmail, "/teacher/dashboard");

      await page.goto("/teacher/semesters");
      await waitForHealthyPage(page, /Live semester management/i);
      await expect(page.getByText(semesterName).first()).toBeVisible({ timeout: 20_000 });

      await page.goto("/teacher/classes");
      await waitForHealthyPage(page, /Live class directory and setup/i);
      const teacherSemesterValue = await getSelectOptionValue(
        page,
        "class-semester-filter",
        semesterName
      );
      await page.locator("#class-semester-filter").selectOption(teacherSemesterValue);
      await expect(page.getByText(className).first()).toBeVisible({ timeout: 20_000 });

      await signOut(page);
      await context.close();
    });
  });
});
