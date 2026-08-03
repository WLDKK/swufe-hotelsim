import { expect, test } from "@playwright/test";
import { loginAs, signOut, waitForHealthyPage } from "./helpers";

test("a student can exercise join-code edge handling from the live team and join pages", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await loginAs(page, "student01@hotelsim.example", "/student/dashboard");
  await page.goto("/student/team");
  await waitForHealthyPage(
    page,
    /Team roster and hotel profile for|团队 roster 与酒店概况/i
  );

  await expect
    .poll(
      async () =>
        page.locator("p").evaluateAll((nodes) => {
          const text = nodes
            .map((node) => node.textContent?.trim() ?? "")
            .find((value) => /^[A-Z0-9-]{6,}$/.test(value));

          return text ?? null;
        }),
      {
        timeout: 15_000,
        message: "Waiting for the student team page to render the live join code.",
      }
    )
    .toMatch(/^[A-Z0-9-]{6,}$/);

  const joinCode =
    (await page.locator("p").evaluateAll((nodes) => {
      const text = nodes
        .map((node) => node.textContent?.trim() ?? "")
        .find((value) => /^[A-Z0-9-]{6,}$/.test(value));

      return text ?? null;
    })) ?? "";

  expect(joinCode).toMatch(/^[A-Z0-9-]{6,}$/);

  await page.goto("/student/join");
  await waitForHealthyPage(
    page,
    /Join-code lookup and assignment status|Join code 核验与分配状态/i
  );

  const verifyButton = page.getByRole("button", {
    name: /Verify join code|核验 join code/i,
  });
  await expect(verifyButton).toBeDisabled();

  await page.getByLabel(/Join code/i).fill("BAD-CODE");
  await expect(verifyButton).toBeEnabled();
  await verifyButton.click();

  await expect(page.getByText(/Class not found\./i)).toBeVisible();

  await page.getByLabel(/Join code/i).fill(joinCode.toLowerCase());
  await verifyButton.click();

  await expect(
    page.getByText(/Matched class|匹配班级/i)
  ).toBeVisible();

  await signOut(page);
  await context.close();
});
