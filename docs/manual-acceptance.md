# Manual Acceptance Script

This document is the human-operated acceptance path for the current release scope. It is intentionally split into a safe read-only pass and a live mutation pass so shared Supabase data is not changed by accident.

## Prerequisites

- `.env` is populated from `.env.example`
- `pnpm install`
- `pnpm db:generate`
- The app can start with `pnpm dev` or `pnpm start`
- For browser automation against a locally hosted build, use `http://127.0.0.1:3000`
- Public demo credentials are configured through `NEXT_PUBLIC_DEMO_PASSWORD` and must be used only with disposable data
- The administrator password is separate, required through `SEED_ADMIN_PASSWORD`, and never printed by the seed script

## Seeded Demo Accounts

- Teacher: `teacher@hotelsim.example`
- Judge: `judge@hotelsim.example`
- Students: `student01@hotelsim.example` through the generated seeded student accounts
- Admin: `admin@hotelsim.example` is still seeded, but its password is intentionally not listed in the public login hints

## Seeded Reference Data

- Main live class: `Hotel Simulation Class A`
- The clean showcase seed keeps one initialized first round ready for fresh体验，不保留旧提交与旧结果记录
- Team names are generated from the seed pool such as `Team Atlas`, `Team Harbor`, and similar variants

## Pass 1: Safe Admin and Route Coverage

These steps should not mutate business data.

1. Sign in as `admin@hotelsim.example`.
2. Open `/admin/dashboard`.
3. Verify the heading `Platform oversight across users, semesters, and live classes`.
4. Verify the section `Recent audit activity`.
5. Verify the section `Actionable alerts`.
6. Confirm the alert workspace shows:
   - total/open/acknowledged/muted/dispatchable counters
   - delivery channel badges
   - direct action links when signals exist
7. Verify the section `Live observability`.
8. Confirm it shows:
   - processing rounds
   - overdue rounds
   - ungraded results
   - 24-hour operator activity
9. Open `/admin/users`.
10. Verify the heading `Platform user provisioning and role control`.
11. Use search and role filters without saving changes.
12. Open `/admin/semesters`.
13. Verify the heading `Semester ownership and teaching windows`.
14. Confirm the owner selector loads teacher/admin options.
15. Open `/admin/classes`.
16. Verify the heading `Cross-semester class management`.
17. Open any class detail page.
18. Verify the shared class detail heading starts with `Admin oversight for`.
19. Verify `Class operations` and `Setup guardrails` are visible.
20. Verify the admin-only section `Admin roster and team management` is visible.
21. Confirm the create-team form, available student pool, and per-team roster cards are visible.

## Pass 1A: Live Alert Operations

Run this only when mutating admin alert state or external delivery is acceptable.

1. Sign in as `admin@hotelsim.example`.
2. Open `/admin/dashboard`.
3. In `Actionable alerts`, identify one active alert.
4. Click `Acknowledge`.
5. Confirm the alert shows an acknowledged state summary and success feedback.
6. Click `Reopen`.
7. Confirm the alert becomes dispatchable again.
8. Click `Mute 24h`.
9. Confirm the alert shows the mute-until timestamp and success feedback.
10. Click `Unmute`.
11. If one or more external channels are configured, click `Dispatch high+ alerts`.
12. Confirm delivery feedback appears and the audit feed records the delivery attempt.

## Pass 2: Live Admin Roster Mutation

Run this only when mutating the shared Supabase dataset is acceptable.

1. Sign in as `admin@hotelsim.example`.
2. Open `/admin/classes`.
3. Open a class detail page that is still suitable for roster edits.
4. In `Admin roster and team management`, verify:
   - creating a team requires a leader
   - creating a brand-new team is only allowed before round processing starts
   - add-member only offers students not already assigned in that class
   - move-member only offers other teams in the same class
   - leaders cannot be removed or moved until reassigned
5. If a setup-only team exists, test:
   - update team name, hotel name, or color
   - change leader
   - add one available student
   - move one non-leader to another team
   - remove one non-leader while keeping minimum team size valid
6. Confirm success feedback appears after each action.
7. Refresh the page and verify the roster state persists.

## Pass 2A: Bulk CSV Roster Import And Export

Run this against a setup-phase class when replacing the roster is acceptable.

1. Sign in as `admin@hotelsim.example`.
2. Open an admin class detail page.
3. In `Bulk CSV roster workspace`, download:
   - template CSV
   - current roster CSV
4. Confirm the exported file uses the canonical headers:
   - `team_name`
   - `hotel_name`
   - `team_color`
   - `student_email`
   - `student_id`
   - `student_name`
   - `team_role`
5. Edit the CSV for a setup class.
6. Upload the file and click `Validate CSV`.
7. Confirm the preview summary shows team count, member count, and the resolved leader for each team.
8. If the class has not started processing rounds yet, click `Apply CSV to class`.
9. Refresh the page and confirm the class roster now matches the imported spreadsheet.
10. Confirm the action is blocked for classes that already progressed beyond setup.

## Pass 3: Teacher-Student-Results-Grading Chain

This validates the core operational loop end to end.

1. Sign in as `teacher@hotelsim.example`.
2. Open `/teacher/simulation`.
3. If `Hotel Simulation Class B` is still at round `0`, initialize round 1.
4. Open the main active class used for the live flow, normally `Hotel Simulation Class A`.
5. Confirm the current round is editable and `Process current round` is disabled until students submit.
6. Sign out.
7. Sign in as each seeded class leader for Class A.
8. Open `/student/decisions`.
9. Save or submit a decision.
10. Verify the confirmation message for successful submission.
11. Sign out and repeat until every team leader in the class has submitted.
12. Sign in again as `teacher@hotelsim.example`.
13. Open `/teacher/classes` or `/teacher/simulation`.
14. Confirm the submission count matches the number of teams.
15. Process the current round.
16. Verify the round advances or the class reaches its configured round ceiling.
17. Open `/teacher/grading`.
18. Select the processed round and save a teacher score/comment for at least one team.
19. Verify the grading success message.
20. Download the current round gradebook CSV from `/teacher/grading`.
21. Confirm the exported file includes ranking, KPI, teacher score, and teacher comment columns.
22. Sign out.
23. Sign in as a student from the graded team.
24. Open `/student/dashboard`, `/student/team`, `/student/results`, `/student/rankings`, and `/student/join`.
25. Confirm the processed round, KPI updates, team roster/context, leaderboard placement, join-code lookup surface, and teacher comment are visible.

## Pass 4: Export and Reporting

1. Sign in as `teacher@hotelsim.example` or `admin@hotelsim.example`.
2. Open a class detail page with processed results.
3. Trigger:
   - results CSV export
   - leaderboard JSON export
   - gradebook CSV export from `/teacher/grading` or `/api/export/grades`
4. Confirm downloads succeed and contain the selected round number.

## Suggested Evidence Capture

- Screenshots of each major page heading
- One screenshot of the admin roster manager
- One screenshot of a successful student submission
- One screenshot of processed results or rankings
- One screenshot of teacher grading feedback saved
- Exported CSV and JSON sample files

## Failure Notes Template

When acceptance fails, capture:

- Date and environment
- URL and signed-in role
- Exact action taken
- Expected result
- Actual result
- Screenshot or downloaded artifact
- Whether the failure reproduces after a full reload

## Related Automated Coverage

- `pnpm test`
- `pnpm test:e2e e2e/auth-and-dashboard.spec.ts`
- `pnpm test:e2e e2e/admin-console.spec.ts`
- `pnpm test:e2e e2e/student-onboarding-edge.spec.ts`
- `E2E_ALLOW_MUTATION=true pnpm test:e2e e2e/stage3-live-flow.spec.ts`
- `ALLOW_DB_RESET=true pnpm db:seed`
- `E2E_ALLOW_MUTATION=true E2E_EXPECT_FRESH_SEED=true pnpm test:e2e e2e/admin-governance-disposable-flow.spec.ts`
- `E2E_ALLOW_MUTATION=true E2E_EXPECT_FRESH_SEED=true pnpm test:e2e e2e/admin-roster-live-flow.spec.ts`
- `E2E_ALLOW_MUTATION=true E2E_EXPECT_FRESH_SEED=true pnpm test:e2e e2e/stage3-disposable-flow.spec.ts`
- `E2E_ALLOW_MUTATION=true E2E_EXPECT_FRESH_SEED=true pnpm test:e2e:disposable`

## Disposable Full-Mutation Sequence

When you need one throwaway Supabase environment to cover the full mutable acceptance chain end to end, use this order:

1. Run `ALLOW_DB_RESET=true pnpm db:seed`.
2. Prefer `E2E_ALLOW_MUTATION=true E2E_EXPECT_FRESH_SEED=true pnpm test:e2e:disposable`.
3. If you need to inspect each mutable slice separately, run governance first, roster second, and Stage 3 third without reseeding in between.

This preserves one fresh disposable environment across the full mutable chain:

- On 2026-04-01, the single-worker disposable script was executed successfully in one fresh disposable Supabase environment without reseeding between steps.
- Admin governance coverage creates a new teacher, assigns a semester, creates a class, and confirms the teacher can access both records.
- Class B covers admin CSV import, interactive roster mutation, teacher initialization, and post-initialization setup locks.
- Class A covers student submission, teacher processing, student results/rankings review, and teacher grading.
