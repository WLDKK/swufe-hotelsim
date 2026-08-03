# Operations And Handoff Runbook

This document is the handoff map for the current codebase and the day-2 operations checklist for the team maintaining it.

## Key Ownership Boundaries

- `prisma/schema.prisma`
  Source of truth for data modeling.
- `prisma/migrations/*`
  Applied schema history for deployment.
- `prisma/seed.ts`
  Demo-data reset and reseed flow. Destructive by design.
- `src/lib/dal/*`
  Reuse boundary for route handlers and future service logic.
- `src/lib/simulation/engine.ts`
  Main simulation engine entry point.
- `src/lib/simulation/formulas.ts`
  Teacher-formula integration seam for the core calculation leaf functions.
- `src/lib/simulation/parameters.ts`
  Stage 7 parameter calibration and formula-tuning entry point.
- `src/lib/simulation/balance-test.ts`
  Seed-backed balance validation harness for engine drift checks.
- `src/lib/audit.ts`
  Best-effort audit writer for high-value admin and teacher mutations.
- `src/lib/dal/observability.ts`
  Aggregates current round pressure, grading backlog, and recent operator activity for admin observability.
- `src/lib/dal/alerts.ts`
  Derives severity-ranked admin alerts and recommended actions from the observability snapshot.
- `src/lib/dal/rounds.ts`
  Centralizes round timeline reads plus guarded round creation/activation.
- `src/lib/dal/alert-state.ts`
  Persists alert acknowledgement and mute state in `SystemConfig`.
- `src/lib/alerts/delivery.ts`
  Sends admin alert digests to configured email, webhook, and Slack targets.
- `src/lib/database/retry.ts`
  Classifies transient Supabase pooler failures and drives centralized read retries.
- `src/app/api/*`
  Authenticated business API surfaces.
- `src/components/student/*`
  Student dashboard, team, join-code lookup, results, rankings, and decision UI.
- `src/components/teacher/*`
  Teacher dashboard, classes, simulation, grading, and shared class detail.
- `src/components/admin/*`
  Admin dashboard, users, semesters, classes, and roster management.

## Day-2 Verification Commands

Run these before and after meaningful changes:

- `pnpm db:validate`
- `pnpm build` once on a clean workspace to generate `.next/types`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e e2e/auth-and-dashboard.spec.ts`
- `pnpm test:e2e e2e/admin-console.spec.ts`
- `pnpm test:e2e e2e/student-onboarding-edge.spec.ts`

Use the live mutation suite only when the shared dataset may be changed:

- `E2E_ALLOW_MUTATION=true pnpm test:e2e e2e/stage3-live-flow.spec.ts`

Use the disposable fresh-seed mutation suite only after reseeding a throwaway database:

- `ALLOW_DB_RESET=true pnpm db:seed`
- `E2E_ALLOW_MUTATION=true E2E_EXPECT_FRESH_SEED=true pnpm test:e2e:disposable`

Use this order when you want one fresh disposable Supabase environment to prove the full mutable business chain instead of isolated one-off slices:

1. `ALLOW_DB_RESET=true pnpm db:seed`
2. `E2E_ALLOW_MUTATION=true E2E_EXPECT_FRESH_SEED=true pnpm test:e2e:disposable`

This sequence was re-verified successfully on 2026-04-01 against one fresh disposable Supabase environment without reseeding between the mutable steps. The single-worker script is the preferred Stage 7 acceptance path because it avoids false negatives from remote Supabase pooler contention.

## Operational Hotspots

### Authentication

- Entry points live under `src/app/(auth)` plus `src/app/api/auth/[...nextauth]`.
- If login fails across all roles, check `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `AUTH_URL`, and `AUTH_SECRET`.
- `/register` is a real student self-service write path and is now backed by CAPTCHA-aware signup plus email-verification-aware auth rules.
- Password reset and resend-verification flows also exist under `src/app/(auth)`.
- Keep broad public signup disabled until real SMTP credentials, Turnstile keys, and abuse-rate policies are configured in the target environment.

### Database Connectivity

- Prisma reads from `DATABASE_URL` and `DIRECT_URL`.
- If Supabase direct connectivity is unstable, keep using the validated pooler-style connection string already documented in the repo.
- `PRISMA_READ_RETRY_ATTEMPTS` and `PRISMA_READ_RETRY_DELAY_MS` control the centralized retry wrapper for read-only Prisma queries.
- During longer disposable browser runs, the Supabase pooler may still show occasional transient Prisma initialization failures in server logs. Treat those as an ops signal to retry or inspect network health, not as automatic proof of a business-logic regression, especially if the end-to-end flow still completes.
- Write mutations are intentionally not auto-retried. If a mutation fails on connectivity, investigate before replaying it to avoid duplicate business changes.

### Roster Management

- Team creation and mutation flow through `src/app/api/teams/route.ts`.
- Admin roster UI is mounted inside shared class detail through `src/components/admin/admin-team-roster-manager.tsx`.
- Bulk roster CSV import/export flows through `src/app/api/roster/csv/route.ts`.
- Brand-new team creation and bulk CSV replacement are setup-only and become unavailable once the class has started processing rounds.
- Team-member uniqueness inside a class is enforced by the `TeamMember` unique constraint on `(classId, userId)`.

### Audit Trail

- High-value admin and teacher mutations now write through `src/lib/audit.ts`.
- Admins can review the newest entries through `src/app/api/audit-logs/route.ts` and the recent activity card on `/admin/dashboard`.
- Audit writes are best-effort by design, so a transient audit insert failure should be investigated but should not be mistaken for a failed primary business mutation.

### Observability

- `/api/observability` provides the admin dashboard with live round pressure, overdue pending rounds, grading backlog, and 24-hour operator activity counts.
- The `Live observability` card on `/admin/dashboard` is the first stop for day-2 review before drilling into classes or audit rows.
- Treat overdue pending rounds or growing grading backlog as operator-action signals, not just passive metrics.

### Alerting

- `/api/alerts` derives severity-ranked operational alerts from the observability snapshot and exposes direct navigation targets for admin follow-up.
- The `Actionable alerts` card on `/admin/dashboard` should be the first response surface when admins need to know what requires action right now.
- `/api/alerts/state` persists alert acknowledgement and mute actions, and `/api/alerts/deliver` sends the current high+ digest to configured external channels.
- Delivery configuration is environment-driven through `EMAIL_SERVER`, `EMAIL_FROM`, `ALERT_EMAIL_TO`, `ALERT_WEBHOOK_URL`, `ALERT_WEBHOOK_BEARER_TOKEN`, and `ALERT_SLACK_WEBHOOK_URL`.
- The dashboard intentionally summarizes delivery targets instead of showing raw secrets or full webhook URLs.

### Simulation And Results

- Teacher-triggered processing starts at `src/app/api/simulation/run/route.ts`.
- Explicit round timeline and guarded manual round activation live under `src/app/api/rounds/route.ts`.
- Result retrieval and export live under:
  - `src/app/api/simulation/results/route.ts`
  - `src/app/api/export/route.ts`
  - `src/app/api/export/grades/route.ts`
- If results are missing, inspect round state, decision submission status, and generated result rows in `round_results`.

## Known Safe Recovery Actions

- Refresh the page after transient server-render failures.
- Re-run `pnpm db:generate` after schema or client drift.
- Re-run `pnpm db:rls` after reapplying migrations to a fresh Supabase environment.
- Re-run the non-destructive E2E suite to distinguish UI breakage from live-data issues.

## High-Risk Actions

- `ALLOW_DB_RESET=true pnpm db:seed`
  This deletes and recreates demo data.
- Manual schema edits in Supabase without corresponding Prisma migration files.
- Running live mutation E2E against a shared environment without coordination.

## Incident Triage Checklist

1. Identify whether the problem is auth, routing, API, database, or simulation specific.
2. Reproduce with the smallest possible role-specific route.
3. Run `pnpm typecheck` and `pnpm test`.
   On a clean checkout, run `pnpm build` first so `.next/types` exists.
4. Run the smallest relevant E2E or manual acceptance slice.
5. Check whether the issue is local-only or also reproduces against Supabase.
6. Document the failing role, route, class, round, and team IDs before patching.

## Handoff Status

Completed:

- Core database, authentication, simulation, grading, and export scope
- Front-end workspaces across student, teacher, admin, and judge surfaces
- Administration, roster management, audit, observability, and alerting
- Branding, localization infrastructure, and shared workspace components
- Formula seams, balance validation, security, deployment, and release readiness
- Browser smoke for auth/dashboard and admin console
- Disposable admin governance mutation coverage for teacher provisioning, semester ownership, class creation, and teacher-side visibility
- Disposable admin roster mutation coverage for CSV import, interactive team setup, and setup-lock verification
- Disposable Stage 3 mutation coverage for seeded leader submission, teacher processing, grading, and student review
- Real disposable-environment end-to-end verification on 2026-04-01 via `pnpm test:e2e:disposable` covering admin governance, Class B admin roster/CSV setup, and Class A teacher-student processing/grading in one fresh-seed run
- Manual acceptance and deployment documentation

Next recommended focus:

- broader production observability such as alert routing policy, provider-specific escalation, or delivery rate controls
- even deeper disposable mutation permutations if the team wants to exercise more admin edge cases per seed
- deployment-time monitoring, logging sinks, and on-call integrations beyond the current dashboard plus stand-alone alert delivery layer
