import { expect, type Page } from "@playwright/test";

export const DEMO_PASSWORD = "HotelSim123!";
const APPLICATION_ERROR_PATTERN =
  /Application error: a server-side exception has occurred/i;
const SIGN_IN_BUTTON_PATTERN = /Sign in|登录/i;
const SIGN_OUT_BUTTON_PATTERN = /Sign out|退出登录/i;
const LIVE_DECISION_WORKSPACE_PATTERN =
  /Live decision workspace for|实时决策工作区/i;
const SUBMIT_DECISION_BUTTON_PATTERN = /Submit decision|提交决策/i;
const CURRENT_ROUND_LABEL_PATTERN = /Current round|当前轮次/i;
const DECISION_STATUS_LABEL_PATTERN = /Decision status|决策状态/i;
const DECISION_SUBMITTED_STATUS_PATTERN = /submitted|已提交/i;
const DECISION_SUBMITTED_SUCCESS_PATTERN =
  /Decision submitted successfully and is now ready for processing\.|决策已成功提交，现已可进入教师处理。/i;
const LOADING_TEXT_PATTERN = /^(Loading|正在)/i;

async function hasVisibleLoadingState(page: Page) {
  const loadingMatches = page.getByText(LOADING_TEXT_PATTERN);
  const count = await loadingMatches.count();

  for (let index = 0; index < Math.min(count, 8); index += 1) {
    if (await loadingMatches.nth(index).isVisible().catch(() => false)) {
      return true;
    }
  }

  return false;
}

export async function loginAs(
  page: Page,
  email: string,
  expectedPath: string
) {
  await page.addInitScript(() => {
    window.localStorage.setItem("swufe-hotelsim-locale", "en-US");
  });
  await page.goto("/login");
  // The auth pages are gradually moving to the shared bilingual shell. Use
  // stable form controls here instead of locale-bound labels so acceptance
  // tests keep working while copy is refined.
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(DEMO_PASSWORD);

  await Promise.all([
    page.waitForURL(new RegExp(expectedPath.replace(/\//g, "\\/"))),
    page.getByRole("button", { name: SIGN_IN_BUTTON_PATTERN }).click(),
  ]);
}

export async function signOut(page: Page) {
  await Promise.all([
    page.waitForURL(/\/login/),
    page.getByRole("button", { name: SIGN_OUT_BUTTON_PATTERN }).click(),
  ]);
}

export async function waitForHealthyPage(
  page: Page,
  headingPattern: RegExp,
  maxAttempts = 5
) {
  // The live Supabase acceptance flow can occasionally surface transient
  // server-render failures. We retry by reloading until the expected heading
  // returns so long serial tests do not fail on a single temporary exception.
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (
      (await page.getByRole("heading", { name: headingPattern }).count()) > 0 &&
      (await page.getByRole("heading", { name: headingPattern }).first().isVisible())
    ) {
      return;
    }

    if ((await page.getByText(APPLICATION_ERROR_PATTERN).count()) > 0) {
      await page.reload();
      continue;
    }

    try {
      await expect(
        page.getByRole("heading", { name: headingPattern }).first()
      ).toBeVisible({ timeout: 5_000 });
      return;
    } catch {
      // Some authenticated pages render the shared shell immediately, then
      // hydrate their business panel from a slower live API call. In that
      // case, reloading too aggressively just restarts the same request loop.
      if (await hasVisibleLoadingState(page)) {
        await page.waitForTimeout(3_000);
        continue;
      }

      await page.reload();
    }
  }

  throw new Error(`Failed to recover page for heading ${headingPattern.toString()}.`);
}

export async function getSelectOptionValue(
  page: Page,
  selectId: string,
  partialLabel: string,
  maxAttempts = 3
) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const select = page.locator(`#${selectId}`);
    await expect(select).toBeVisible();

    try {
      await expect
        .poll(
          async () =>
            select.evaluate((element, partial) => {
              const selectElement = element as HTMLSelectElement;
              const match = Array.from(selectElement.options).find((option) =>
                option.textContent?.includes(String(partial))
              );

              return match?.value ?? null;
            }, partialLabel),
          {
            timeout: 15_000,
            message: `Waiting for option containing "${partialLabel}" in #${selectId}.`,
          }
        )
        .not.toBeNull();

      const value = await select.evaluate((element, partial) => {
        const selectElement = element as HTMLSelectElement;
        const match = Array.from(selectElement.options).find((option) =>
          option.textContent?.includes(String(partial))
        );

        return match?.value ?? null;
      }, partialLabel);

      if (value) {
        return value;
      }
    } catch {
      if (attempt === maxAttempts - 1) {
        break;
      }

      // When the live API chain stalls in a loading state, a full reload is the
      // most realistic recovery path. The next request often succeeds once the
      // remote pooler recovers, without changing any test-side assumptions.
      await page.reload();
    }
  }

  throw new Error(
    `Could not find option containing "${partialLabel}" in #${selectId}.`
  );
}

export async function getFirstNonPlaceholderOptionValue(
  page: Page,
  selectId: string
) {
  const select = page.locator(`#${selectId}`);
  await expect(select).toBeVisible();

  // Disposable-environment mutation flows often need "any valid option" rather
  // than a fixed seeded label. Poll here because the select itself renders
  // before the async option list arrives in slower live Supabase environments.
  await expect
    .poll(
      async () =>
        select.evaluate((element) => {
          const selectElement = element as HTMLSelectElement;
          const match = Array.from(selectElement.options).find(
            (option) => option.value.trim().length > 0 && !option.disabled
          );

          return match?.value ?? null;
        }),
      {
        timeout: 15_000,
        message: `Waiting for a selectable non-placeholder option in #${selectId}.`,
      }
    )
    .not.toBeNull();

  const value = await select.evaluate((element) => {
    const selectElement = element as HTMLSelectElement;
    const match = Array.from(selectElement.options).find(
      (option) => option.value.trim().length > 0 && !option.disabled
    );

    return match?.value ?? null;
  });

  if (!value) {
    throw new Error(`Could not find a selectable non-placeholder option in #${selectId}.`);
  }

  return value;
}

export async function readStatValue(page: Page, label: string | RegExp) {
  const statLabel =
    typeof label === "string"
      ? page.getByText(label, { exact: true }).first()
      : page.getByText(label).first();
  await expect(statLabel).toBeVisible();

  return (
    (await statLabel.locator("xpath=following-sibling::p[1]").textContent())?.trim() ??
    ""
  );
}

export async function readRoundProgress(page: Page, maxAttempts = 3) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await expect
        .poll(
          async () => {
            const value = await readStatValue(page, CURRENT_ROUND_LABEL_PATTERN);
            return /(\d+)\s*\/\s*(\d+)/.test(value) ? value : null;
          },
          {
            timeout: 15_000,
            message: "Waiting for the teacher simulation round progress to load.",
          }
        )
        .not.toBeNull();

      const value = await readStatValue(page, CURRENT_ROUND_LABEL_PATTERN);
      const match = value.match(/(\d+)\s*\/\s*(\d+)/);

      if (match) {
        return {
          current: Number(match[1]),
          max: Number(match[2]),
          raw: value,
        };
      }
    } catch {
      if (attempt === maxAttempts - 1) {
        break;
      }

      await page.reload();
      await waitForHealthyPage(page, /Cross-class simulation operations center/i);
    }
  }

  const value = await readStatValue(page, CURRENT_ROUND_LABEL_PATTERN);
  throw new Error(`Could not parse round progress from "${value}".`);
}

export async function readDecisionWorkspaceTeamName(page: Page) {
  const heading = page
    .getByRole("heading", { name: LIVE_DECISION_WORKSPACE_PATTERN })
    .first();
  await expect(heading).toBeVisible();

  const headingText = (await heading.textContent())?.trim() ?? "";
  const englishMatch = headingText.match(/^Live decision workspace for\s+(.+)$/i);
  if (englishMatch) {
    return englishMatch[1].trim();
  }

  const chinesePrefix = "实时决策工作区";
  if (headingText.startsWith(chinesePrefix)) {
    return headingText
      .slice(chinesePrefix.length)
      .replace(/^[:：\s]+/, "")
      .trim();
  }

  throw new Error(`Could not parse the decision workspace team name from "${headingText}".`);
}

export async function ensureCurrentDecisionSubmitted(page: Page) {
  await page.goto("/student/decisions");
  await waitForHealthyPage(page, LIVE_DECISION_WORKSPACE_PATTERN);

  const teamName = await readDecisionWorkspaceTeamName(page);
  const submitButton = page.getByRole("button", {
    name: SUBMIT_DECISION_BUTTON_PATTERN,
  });
  await expect(submitButton).toBeVisible();

  await expect
    .poll(
      async () => {
        if (await hasVisibleLoadingState(page)) {
          return "loading";
        }

        const status = await readStatValue(page, DECISION_STATUS_LABEL_PATTERN);
        if (DECISION_SUBMITTED_STATUS_PATTERN.test(status)) {
          return "submitted";
        }

        return (await submitButton.isEnabled()) ? "editable" : "waiting";
      },
      {
        timeout: 30_000,
        message: "Waiting for the decision workspace to become actionable.",
      }
    )
    .toMatch(/submitted|editable/);

  // Fresh-seed mutation flows can start with a mix of draft and already
  // submitted decisions. Make this helper idempotent so serial teacher/student
  // acceptance specs can safely iterate over every seeded leader account.
  if (
    !DECISION_SUBMITTED_STATUS_PATTERN.test(
      await readStatValue(page, DECISION_STATUS_LABEL_PATTERN)
    )
  ) {
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    await expect(
      page.getByText(DECISION_SUBMITTED_SUCCESS_PATTERN)
    ).toBeVisible();
    await expect
      .poll(async () => readStatValue(page, DECISION_STATUS_LABEL_PATTERN), {
        timeout: 15_000,
        message: "Waiting for the decision status summary to refresh to SUBMITTED.",
      })
      .toMatch(DECISION_SUBMITTED_STATUS_PATTERN);
  }

  return teamName;
}
