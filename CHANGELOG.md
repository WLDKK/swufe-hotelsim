# Changelog

## 2026-08-03

### Open-source release preparation

- Added the MIT License, public-facing README, contribution guide, security policy, code of conduct, citation metadata, issue forms, pull request template, and Dependabot configuration.
- Documented the project's prior internal teaching and practice use with approximately 200 student participants, together with an independent-project disclaimer.
- Replaced institution-domain demo addresses with reserved synthetic addresses.
- Removed the hard-coded administrator seed credential, made `SEED_ADMIN_PASSWORD` mandatory, and stopped printing credential values.
- Hardened Supabase RLS helper functions with an empty search path, explicit execution grants, and RLS coverage for newer competition tables.
- Upgraded Next.js, React, Auth.js, Prisma, and Nodemailer to patched releases and added audited transitive dependency overrides.

## 2026-04-10

### Documentation

- Replaced the garbled root-level `重构建议.md` with a clean UTF-8 competition-oriented refactor plan aligned to the current repository structure.
- Expanded the refactor guidance so it now maps directly onto the live codebase, covering reusable modules, required competition-domain upgrades, migration order, and the safest next-step sequence.
- Added a second refinement pass to the refactor plan with schema-level gap analysis, minimum viable competition data-model upgrades, directory-organization guidance, large-file split priorities, and a staged execution backlog.
- Added the refactor plan to the main `README.md` documentation index so future handoff and review work can find it quickly.

### Maintenance

- Normalized the repository-level planning artifact after the earlier encoding issue so downstream editing and document export no longer start from corrupted source text.

## 2026-04-06

### UI / UX

- Unified the student, teacher, and admin hero surfaces onto one shared `WorkspaceHero` base component so spacing, CTA hierarchy, and responsive behavior stay consistent across Stage 6 workspaces.
- Refined the shared workspace shell and navigation for smaller screens by switching the nav from mostly horizontal overflow to a clearer responsive grid, and tightened shell spacing and sticky header behavior.
- Moved the student dashboard onto the same shared hero pattern used by the other workspace pages so the top-of-page information hierarchy stays consistent.

### Performance / Stability

- Improved React Query defaults to avoid retrying known 4xx client failures while still retrying transient network or 5xx issues.
- Increased query cache lifetime and enabled reconnect refresh so dashboard data feels steadier during short network interruptions.
- Added `keepPreviousData` to class-switch-driven teacher panels to reduce empty flashes while the next class snapshot is loading.

### Maintenance

- Removed repeated hero markup across role-specific components and centralized the visual contract in one shared layout component.
- Preserved existing business routes and acceptance selectors so the Stage 2-7 flow remains stable while the presentation layer evolves.

### Verification

- Validation target for this optimization batch: `pnpm release:check` plus key Playwright smoke coverage for student, teacher, and admin workspaces.
