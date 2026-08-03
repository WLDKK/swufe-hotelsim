import { expect, test } from "@playwright/test";
import {
  ensureCurrentDecisionSubmitted,
  getSelectOptionValue,
  loginAs,
  readRoundProgress,
  signOut,
  waitForHealthyPage,
} from "./helpers";

const mutationEnabled = process.env.E2E_ALLOW_MUTATION === "true";
const freshSeedExpected = process.env.E2E_EXPECT_FRESH_SEED === "true";
const teacherSimulationHeading = /Cross-class simulation operations center/i;
const teacherGradingHeading = /Teacher grading and feedback workspace/i;
const studentDashboardHeading = /Team cockpit for/i;
const classALabel = "Hotel Simulation Class A";
const classALeaderEmails = [
  "student01@hotelsim.example",
  "student04@hotelsim.example",
  "student07@hotelsim.example",
  "student10@hotelsim.example",
] as const;

test.describe("fresh-seed Stage 3 disposable acceptance flow", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(10 * 60 * 1000);
  test.skip(
    !mutationEnabled || !freshSeedExpected,
    "Set E2E_ALLOW_MUTATION=true and E2E_EXPECT_FRESH_SEED=true before running this disposable Stage 3 flow."
  );

  // This spec assumes a freshly reseeded throwaway database. Class A should
  // still be on the seed-provided round 2 state, which makes the flow safe to
  // rerun only after resetting the disposable environment again.
  test("teacher process + student review + teacher grading on a fresh-seed database", async ({
    browser,
  }) => {
    let classAId = "";
    let focusTeamName = "";
    let processedRoundNumber = 0;

    await test.step("Teacher verifies the seeded Class A round state", async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await loginAs(page, "teacher@hotelsim.example", "/teacher/dashboard");
      await page.goto("/teacher/simulation");
      await waitForHealthyPage(page, teacherSimulationHeading);

      classAId = await getSelectOptionValue(page, "teacher-simulation-class", classALabel);
      await page.goto(`/teacher/simulation?classId=${classAId}`);
      await waitForHealthyPage(page, teacherSimulationHeading);

      const progress = await readRoundProgress(page);
      expect(progress.current).toBe(2);
      expect(progress.max).toBeGreaterThanOrEqual(2);
      await expect(
        page.getByRole("button", { name: "Process current round" })
      ).toBeDisabled();

      await signOut(page);
      await context.close();
    });

    await test.step("Seeded leaders ensure the active round is fully submitted", async () => {
      for (const email of classALeaderEmails) {
        const context = await browser.newContext();
        const page = await context.newPage();

        await loginAs(page, email, "/student/dashboard");
        const teamName = await ensureCurrentDecisionSubmitted(page);
        if (email === "student01@hotelsim.example") {
          focusTeamName = teamName;
        }
        await signOut(page);
        await context.close();
      }
    });

    await test.step("Teacher processes the seeded active round", async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await loginAs(page, "teacher@hotelsim.example", "/teacher/dashboard");
      await page.goto(`/teacher/simulation?classId=${classAId}`);
      await waitForHealthyPage(page, teacherSimulationHeading);

      const currentProgress = await readRoundProgress(page);
      processedRoundNumber = currentProgress.current;
      expect(processedRoundNumber).toBe(2);

      const processButton = page.getByRole("button", { name: "Process current round" });
      await expect(processButton).toBeEnabled({ timeout: 20_000 });
      await processButton.click();

      await expect
        .poll(
          async () => {
            await page.reload();
            await waitForHealthyPage(page, teacherSimulationHeading);
            return (await readRoundProgress(page)).current;
          },
          {
            timeout: 60_000,
            message: "Waiting for the fresh-seed disposable class to advance after processing.",
          }
        )
        .toBe(3);

      await signOut(page);
      await context.close();
    });

    const gradingComment = `Disposable Stage 3 note ${Date.now()}`;

    await test.step("Teacher grades the dynamically resolved focus team", async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await loginAs(page, "teacher@hotelsim.example", "/teacher/dashboard");
      await page.goto(`/teacher/grading?classId=${classAId}`);
      await waitForHealthyPage(page, teacherGradingHeading);
      await page.locator("#teacher-grading-round").selectOption(String(processedRoundNumber));

      const gradingCard = page.locator(
        `[data-testid="grading-card"][data-team-name="${focusTeamName}"]`
      );
      await expect(gradingCard).toBeVisible();

      await gradingCard.getByTestId("teacher-score-input").fill("94");
      await gradingCard.getByTestId("teacher-comment-input").fill(gradingComment);
      await gradingCard.getByTestId("save-grading-button").click();

      await expect(
        page.getByText("Teacher grading has been saved to the live results record.")
      ).toBeVisible();

      await signOut(page);
      await context.close();
    });

    await test.step("Student reviews the new processed result and saved grading feedback", async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await loginAs(page, "student01@hotelsim.example", "/student/dashboard");
      await page.goto("/student/dashboard");
      await waitForHealthyPage(page, studentDashboardHeading);
      await expect(
        page.getByRole("heading", {
          name: new RegExp(`Team cockpit for ${focusTeamName}`, "i"),
        })
      ).toBeVisible();
      await expect(page.getByText(gradingComment).first()).toBeVisible();

      await page.goto("/student/results");
      await waitForHealthyPage(
        page,
        new RegExp(`Team results for ${focusTeamName}`, "i")
      );
      await expect(page.getByText(gradingComment).first()).toBeVisible();
      await expect(page.getByText(`Round ${processedRoundNumber}`).first()).toBeVisible();

      await page.goto("/student/rankings");
      await waitForHealthyPage(page, /Class leaderboard for/i);
      await expect(page.getByText(`Round ${processedRoundNumber}`).first()).toBeVisible();

      await signOut(page);
      await context.close();
    });
  });
});
