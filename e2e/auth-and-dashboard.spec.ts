import { expect, test } from "@playwright/test";
import { loginAs, signOut, waitForHealthyPage } from "./helpers";

// This smoke walks three roles through multiple live authenticated routes in
// one test. Keep a wider timeout budget so slower Supabase pooler responses do
// not fail the run while the browser is still moving through healthy pages.
test.setTimeout(180_000);

test("teacher, student, and admin can sign in and open their live dashboards", async ({
  browser,
}) => {
  const teacherContext = await browser.newContext();
  const teacherPage = await teacherContext.newPage();

  await loginAs(teacherPage, "teacher@hotelsim.example", "/teacher/dashboard");
  await waitForHealthyPage(
    teacherPage,
    /Teaching overview across live classes/i
  );
  await expect(
    teacherPage.getByRole("link", { name: "Simulation", exact: true })
  ).toBeVisible();
  await teacherPage.goto("/teacher/semesters");
  await waitForHealthyPage(
    teacherPage,
    /Live semester management/i
  );
  await teacherPage.goto("/teacher/classes");
  await waitForHealthyPage(
    teacherPage,
    /Live class directory and setup/i
  );
  // This smoke only needs to prove that the live class directory itself is
  // healthy. The current shared environment may legitimately contain zero
  // teacher-visible classes, so class-detail navigation is covered elsewhere
  // and should not make this cross-role login smoke brittle.
  await teacherPage.goto("/teacher/simulation");
  await waitForHealthyPage(
    teacherPage,
    /Cross-class simulation operations center/i
  );
  await teacherPage.goto("/teacher/grading");
  await waitForHealthyPage(
    teacherPage,
    /Teacher grading and feedback workspace/i
  );
  await signOut(teacherPage);
  await teacherContext.close();

  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();
  const studentNav = studentPage.getByRole("navigation", {
    name: /Workspace navigation/i,
  });

  await loginAs(studentPage, "student01@hotelsim.example", "/student/dashboard");
  await waitForHealthyPage(
    studentPage,
    /Team cockpit for|\u56e2\u961f\u9a7e\u9a76\u8231/i
  );
  await expect(
    studentNav.getByRole("link", { name: /Decisions|\u51b3\u7b56/i })
  ).toBeVisible();
  await expect(
    studentNav.getByRole("link", { name: /Results|\u7ed3\u679c/i })
  ).toBeVisible();
  await expect(
    studentNav.getByRole("link", { name: /Team|\u56e2\u961f/i })
  ).toBeVisible();
  await expect(
    studentNav.getByRole("link", { name: /Join|\u52a0\u5165/i })
  ).toBeVisible();
  await studentPage.goto("/student/team");
  await waitForHealthyPage(
    studentPage,
    /Team roster and hotel profile for|\u56e2\u961f roster \u4e0e\u9152\u5e97\u6982\u51b5/i
  );
  await expect
    .poll(
      async () =>
        studentPage.locator("p").evaluateAll((nodes) => {
          const text = nodes
            .map((node) => node.textContent?.trim() ?? "")
            .find((value) => /^[A-Z0-9-]{6,}$/.test(value));

          return text ?? null;
        }),
      {
        timeout: 15_000,
        message: "Waiting for the student team page to finish rendering the join code.",
      }
    )
    .toMatch(/^[A-Z0-9-]{6,}$/);
  const joinCode =
    (await studentPage.locator("p").evaluateAll((nodes) => {
      const text = nodes
        .map((node) => node.textContent?.trim() ?? "")
        .find((value) => /^[A-Z0-9-]{6,}$/.test(value));

      return text ?? null;
    })) ?? "";
  await studentPage.goto("/student/decisions");
  await waitForHealthyPage(
    studentPage,
    /Live decision workspace for|\u5b9e\u65f6\u51b3\u7b56\u5de5\u4f5c\u533a/i
  );
  await studentPage.goto("/student/results");
  await waitForHealthyPage(
    studentPage,
    /Team results for|\u56e2\u961f\u7ed3\u679c/i
  );
  await studentPage.goto("/student/rankings");
  await waitForHealthyPage(
    studentPage,
    /Class leaderboard for|\u73ed\u7ea7\u6392\u884c\u699c/i
  );
  await studentPage.goto("/student/join");
  await waitForHealthyPage(
    studentPage,
    /Join-code lookup and assignment status|Join code \u6821\u9a8c\u4e0e\u5206\u914d\u72b6\u6001/i
  );
  await studentPage.getByLabel(/Join code|\u9080\u8bf7\u7801/i).fill(joinCode);
  await studentPage
    .getByRole("button", {
      name: /Verify join code|\u6821\u9a8c join code/i,
    })
    .click();
  await expect(
    studentPage.getByText(/Matched class|\u5339\u914d\u73ed\u7ea7/)
  ).toBeVisible();
  await signOut(studentPage);
  await studentContext.close();

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();

  await loginAs(adminPage, "admin@hotelsim.example", "/admin/dashboard");
  await expect(
    adminPage.getByRole("heading", {
      name: /Platform oversight across users, semesters, and live classes/i,
    })
  ).toBeVisible();
  await expect(
    adminPage.getByRole("link", { name: "Users", exact: true })
  ).toBeVisible();
  await expect
    .poll(
      async () =>
        adminPage
          .getByRole("heading", { name: /Recent audit activity/i })
          .count(),
      {
        timeout: 20_000,
        message: "Waiting for the admin dashboard audit feed to render.",
      }
    )
    .toBeGreaterThan(0);
  await expect
    .poll(
      async () =>
        adminPage.getByRole("heading", { name: /Actionable alerts/i }).count(),
      {
        timeout: 20_000,
        message: "Waiting for the admin dashboard alert feed to render.",
      }
    )
    .toBeGreaterThan(0);
  await expect
    .poll(
      async () =>
        adminPage.getByRole("heading", { name: /Live observability/i }).count(),
      {
        timeout: 20_000,
        message: "Waiting for the admin dashboard observability card to render.",
      }
    )
    .toBeGreaterThan(0);
  await expect(
    adminPage.getByRole("link", { name: "Semesters", exact: true })
  ).toBeVisible();
  await expect(
    adminPage.getByRole("link", { name: "Classes", exact: true })
  ).toBeVisible();
  await adminPage.goto("/admin/users");
  await waitForHealthyPage(
    adminPage,
    /Platform user provisioning and role control/i
  );
  await adminPage.goto("/admin/semesters");
  await waitForHealthyPage(
    adminPage,
    /Semester ownership and teaching windows/i
  );
  await adminPage.goto("/admin/classes");
  await waitForHealthyPage(
    adminPage,
    /Cross-semester class management/i
  );
  await signOut(adminPage);
  await adminContext.close();
});
