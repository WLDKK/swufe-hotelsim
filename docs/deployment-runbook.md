# Deployment Runbook

This runbook is the operational path for promoting the current SWUFE HotelSim build onto an environment backed by Supabase Postgres.

## Scope

- Next.js 14 application runtime
- Prisma schema and migrations
- Supabase-hosted Postgres
- Auth.js credential-based login
- simulation, grading, export, admin governance, alerting, localization, and release hardening

## Required Environment Variables

Copy `.env.example` and fill the production-safe values:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `AUTH_URL`
- `AUTH_SECRET`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTH_REQUIRE_EMAIL_VERIFICATION`
- `AUTH_ENABLE_CAPTCHA`
- `AUTH_EMAIL_VERIFICATION_TTL_HOURS`
- `AUTH_PASSWORD_RESET_TTL_MINUTES`
- `PASSWORD_BCRYPT_ROUNDS`
- `EMAIL_SERVER`
- `EMAIL_FROM`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `ALERT_EMAIL_TO`
- `ALERT_WEBHOOK_URL`
- `ALERT_WEBHOOK_BEARER_TOKEN`
- `ALERT_SLACK_WEBHOOK_URL`
- `PRISMA_READ_RETRY_ATTEMPTS`
- `PRISMA_READ_RETRY_DELAY_MS`

## Pre-Deployment Checklist

1. Confirm the target branch is the intended release candidate.
2. Run `pnpm install`.
3. Run `pnpm db:generate`.
4. Run `pnpm db:validate`.
5. Run `pnpm build` once on a clean workspace to generate `.next/types`.
6. Run `pnpm typecheck`.
7. Run `pnpm lint`.
8. Run `pnpm test`.
9. Run the browser smoke suite:
   - `pnpm test:e2e e2e/auth-and-dashboard.spec.ts`
   - `pnpm test:e2e e2e/admin-console.spec.ts`
   - `pnpm test:e2e e2e/student-onboarding-edge.spec.ts`
10. If the shared Supabase environment may be mutated safely, run:
   - `E2E_ALLOW_MUTATION=true pnpm test:e2e e2e/stage3-live-flow.spec.ts`
11. If the target is a disposable fresh-seed environment, run:
   - `ALLOW_DB_RESET=true pnpm db:seed`
   - `E2E_ALLOW_MUTATION=true E2E_EXPECT_FRESH_SEED=true pnpm test:e2e:disposable`
   - This single-worker disposable chain was validated successfully on 2026-04-01 in one fresh disposable Supabase environment.

## Registration Readiness Note

- `/register` already creates real student accounts and now supports CAPTCHA gating plus email-verification-aware auth flows.
- Password reset and resend-verification pages are also present in the current auth surface.
- Before exposing public signup widely, configure real SMTP credentials, Turnstile keys, and an explicit operational policy for orphan student accounts and verification email delivery failures.

## Database Deployment

The Prisma schema is the source of truth.

1. Point `DATABASE_URL` and `DIRECT_URL` at the target Supabase project.
2. Run `pnpm db:generate`.
3. Run `pnpm db:deploy`.
4. Run `pnpm db:rls`.
5. Only for disposable environments, optionally run:
   - `ALLOW_DB_RESET=true pnpm db:seed`
6. When validating a throwaway release candidate end to end, follow the seed with:
   - `E2E_ALLOW_MUTATION=true E2E_EXPECT_FRESH_SEED=true pnpm test:e2e:disposable`
   - Keep the same seeded database across that run so governance, roster, and Stage 3 execute on one disposable environment.

## Application Build and Start

1. Run `pnpm build`.
2. Run `pnpm start`.
3. Confirm the site serves successfully on the configured port.

## Post-Deploy Smoke Checks

Verify these routes after deployment:

- `/login`
- `/student/dashboard`
- `/student/team`
- `/student/join`
- `/teacher/dashboard`
- `/teacher/simulation`
- `/teacher/grading`
- confirm the grading screen can expose the current round gradebook download when processed results exist
- `/admin/dashboard`
- confirm `Recent audit activity` renders on `/admin/dashboard`
- confirm `Actionable alerts` renders on `/admin/dashboard`
- confirm the alert card shows delivery-channel badges plus acknowledge/mute controls
- confirm `Live observability` renders on `/admin/dashboard`
- `/admin/users`
- `/admin/semesters`
- `/admin/classes`

## Supabase CLI Notes

- The project uses a repo-local CLI installation via `pnpm exec supabase`.
- CLI login is optional for the Prisma-first deployment path above.
- Only use `supabase link`, `supabase db pull`, or similar remote-management commands when the workflow explicitly requires them.
- The fresh-seed disposable mutation suite does not require CLI login by itself; it only requires the app environment to point at the throwaway Supabase database that was just reseeded.

## Rollback Guidance

If the deploy fails after code rollout but before healthy validation:

1. Stop new rollout traffic.
2. Revert to the last known-good application build.
3. Re-run smoke checks against the reverted build.
4. If the issue was caused by a migration, assess whether a forward-fix migration is safer than a manual rollback.
5. Do not run the destructive seed on a shared production dataset.

## Release Evidence

Capture and store:

- git commit SHA
- exact migration set deployed
- `pnpm build` result
- automated test summary
- if disposable validation was part of release evidence, record whether `pnpm test:e2e:disposable` passed on the same seed
- smoke-check screenshots or logs
