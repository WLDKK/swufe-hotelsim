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
const teacherSimulationHeading = /Cross-class simulation operations center/i;
const teacherGradingHeading = /Teacher grading and feedback workspace/i;
const studentDashboardHeading = /Team cockpit for/i;
const classALabel = "Hotel Simulation Class A";
const classBLabel = "Hotel Simulation Class B";
const classALeaderEmails = [
  "student01@hotelsim.example",
  "student04@hotelsim.example",
  "student07@hotelsim.example",
  "student10@hotelsim.example",
] as const;

test.describe("live Stage 3 acceptance flow", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(10 * 60 * 1000);
  test.skip(
    !mutationEnabled,
    "Set E2E_ALLOW_MUTATION=true before running the live Stage 3 mutation flow."
  );

  // This acceptance test mutates the shared remote Supabase dataset on purpose.
  // Keep it serial so teacher actions, student submissions, result processing,
  // and grading stay aligned with one concrete round transition.
  test("teacher initialize + student submit + teacher process + student review + teacher grading", async ({
    browser,
  }) => {
    let classAId = "";
    let classBId = "";
    let focusTeamName = "";
    let processedRoundNumber = 0;
    let nextRoundNumber = 0;

    await test.step("Teacher initializes the setup class when needed", async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await loginAs(page, "teacher@hotelsim.example", "/teacher/dashboard");
      await page.goto("/teacher/simulation");
      await waitForHealthyPage(page, teacherSimulationHeading);

      classAId = await getSelectOptionValue(page, "teacher-simulation-class", classALabel);
      classBId = await getSelectOptionValue(page, "teacher-simulation-class", classBLabel);

      await page.goto(`/teacher/simulation?classId=${classBId}`);
      await waitForHealthyPage(page, teacherSimulationHeading);

      // Class B is reserved as the safer initialization target because Class A
      // is the richer seeded class used for the full student/teacher loop below.
      const classBProgress = await readRoundProgress(page);
      if (classBProgress.current === 0) {
        await page.getByRole("button", { name: "Initialize round 1" }).click();
        await expect
          .poll(
            async () => {
              await page.reload();
              await waitForHealthyPage(page, teacherSimulationHeading);
              return (await readRoundProgress(page)).current;
            },
            { timeout: 20_000 }
          )
          .toBeGreaterThanOrEqual(1);
        await expect(await readRoundProgress(page)).toMatchObject({ current: 1 });
      } else {
        await expect(page.getByText(classBProgress.raw, { exact: true })).toBeVisible();
      }

      await signOut(page);
      await context.close();
    });

    await test.step("All class leaders submit the current round decision", async () => {
      for (const email of classALeaderEmails) {
        const context = await browser.newContext();
        const page = await context.newPage();

        await loginAs(page, email, "/student/dashboard");
        const teamName = await ensureCurrentDecisionSubmitted(page);
        if (email === "student01@hotelsim.example") {
          // Use one concrete seeded leader as the anchor for later grading and
          // student review assertions, but resolve the team name dynamically so
          // the spec survives seed-name randomization.
          focusTeamName = teamName;
        }
        await signOut(page);
        await context.close();
      }
    });

    await test.step("Teacher processes the current class round", async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await loginAs(page, "teacher@hotelsim.example", "/teacher/dashboard");
      await page.goto(`/teacher/simulation?classId=${classAId}`);
      await waitForHealthyPage(page, teacherSimulationHeading);

      const currentProgress = await readRoundProgress(page);
      processedRoundNumber = currentProgress.current;
      nextRoundNumber =
        processedRoundNumber >= currentProgress.max
          ? processedRoundNumber
          : processedRoundNumber + 1;

      const processButton = page.getByRole("button", { name: "Process current round" });
      await expect(processButton).toBeEnabled({ timeout: 20_000 });
      // The live flow intentionally submits every seeded leader first, so this
      // click should represent a real teacher-side transition from editable
      // round inputs into persisted Stage 3 results.
      await expect(page.getByText(`${processedRoundNumber} / ${currentProgress.max}`)).toBeVisible();
      await page.getByRole("button", { name: "Process current round" }).click();

      await expect
        .poll(
          async () => {
            await page.reload();
            await waitForHealthyPage(page, teacherSimulationHeading);
            return (await readRoundProgress(page)).current;
          },
          { timeout: 60_000 }
        )
        .toBe(nextRoundNumber);

      await signOut(page);
      await context.close();
    });

    const gradingComment = `E2E grading note ${Date.now()}`;

    await test.step("Teacher grades the dynamically resolved focus team on the processed round", async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await loginAs(page, "teacher@hotelsim.example", "/teacher/dashboard");
      await page.goto(`/teacher/grading?classId=${classAId}`);
      await waitForHealthyPage(page, teacherGradingHeading);
      await page
        .locator("#teacher-grading-round")
        .selectOption(String(processedRoundNumber));

      const gradingCard = page.locator(
        `[data-testid="grading-card"][data-team-name="${focusTeamName}"]`
      );
      await expect(gradingCard).toBeVisible();

      await gradingCard.getByTestId("teacher-score-input").fill("92.5");
      await gradingCard.getByTestId("teacher-comment-input").fill(gradingComment);
      await gradingCard.getByTestId("save-grading-button").click();

      await expect(
        page.getByText("Teacher grading has been saved to the live results record.")
      ).toBeVisible();
      await signOut(page);
      await context.close();
    });

    await test.step("Student reviews dashboard, results, rankings, and grading feedback after processing", async () => {
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
      await expect(page.getByText(`Round ${processedRoundNumber}`).first()).toBeVisible();

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
