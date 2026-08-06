# Competition-grade product roadmap

Updated: 2026-08-06

## Delivered in the current release candidate

- Formal SWUFE visual system across the landing page, authentication, role workspaces, judge console, and public display.
- Mobile-first authentication order, compact navigation, 44px interaction targets, skip navigation, and reduced-motion support.
- Global route/root error boundaries, a custom 404, public-display data degradation, and `/api/health`.
- Atomic round processing claim to prevent duplicate simulation runs.
- Competition-level judge assignments enforced in classes, results, dashboards, and score mutations.
- Admin competition operations for competition/stage creation, lifecycle progression, judge assignment, announcements, and round-stage linking.
- Cloudflare Workers/OpenNext configuration and a Workers-compatible Prisma PostgreSQL adapter.
- Prisma migration and explicit RLS policies for the competition operations layer.

## Next competition cycle

1. Split the largest teacher simulation, admin governance, and student decision components into route-level feature modules.
2. Add rubric templates, multi-dimensional judge forms, score locking, appeal windows, and chief-judge review.
3. Add competition registration, team eligibility checks, stage seeding, advancement brackets, and award publishing.
4. Add mobile and accessibility projects to Playwright, with WCAG automated checks and performance budgets.
5. Introduce production alerts for database saturation, round-processing latency, authentication abuse, and failed external delivery.
6. Add recovery drills, data-retention policy, audit export, and a documented competition-day operating checklist.

## Release gates

A release is eligible for a formal competition only when migrations, `release:check`, Workers build, health check, role smoke tests, judge authorization tests, round concurrency tests, and a disposable full competition rehearsal have all passed on the candidate commit.
