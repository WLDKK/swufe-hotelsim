# SWUFE HotelSim

SWUFE HotelSim is an open-source hotel management simulation platform for experiential education and competition-based learning. It provides a complete workflow for students, teachers, administrators, and judges: class organization, team operations, round-based decisions, simulation processing, rankings, grading, auditability, and release operations.

The project was initially used for internal teaching and practice, with approximately 200 student participants. It is now published so educators and developers can study, adapt, and improve the platform.

> **Independent project notice:** This repository is maintained independently and does not represent an official statement, product, or endorsement of Southwestern University of Finance and Economics (SWUFE). The SWUFE name identifies the project's origin and prior teaching context.

## Highlights

- Role-aware workspaces for students, teachers, administrators, and judges
- Semester, class, team, roster, round, decision, result, and grading workflows
- Configurable and reproducible hotel-management simulation engine
- Competition stages, versioned rulesets, announcements, and public leaderboards
- Prisma migrations with Supabase/Postgres row-level-security policies
- Auth.js credentials flow with RBAC, verification, password reset, and CAPTCHA hooks
- Audit logs, observability, alert state, and external notification integrations
- Unit, integration, balance, and Playwright end-to-end test coverage
- Vercel deployment configuration and GitHub Actions release gates
- Chinese-first interface with an extensible localization layer

## Architecture

| Layer | Technology |
| --- | --- |
| Web application | Next.js 15, React 19, TypeScript, Tailwind CSS |
| Authentication | Auth.js with role-aware routing and guards |
| Data access | Prisma ORM and PostgreSQL |
| Managed database | Supabase, with source-controlled RLS policies |
| Testing | Vitest, Testing Library, Playwright |
| Delivery | GitHub Actions and Vercel |

The main reuse boundaries are:

- `src/app`: application routes, dashboards, and API handlers
- `src/components`: role-specific and shared UI
- `src/lib/dal`: database access layer
- `src/lib/simulation`: rules, scoring, explanations, and balance checks
- `prisma`: schema, migrations, and synthetic demo seed
- `supabase`: local configuration and RLS policy source
- `docs`: deployment, operations, calibration, and acceptance guides

## Quick start

### Prerequisites

- Node.js 20 or newer
- pnpm 10.18.0
- A disposable PostgreSQL or Supabase development database

### Installation

```bash
git clone https://github.com/WLDKK/swufe-hotelsim.git
cd swufe-hotelsim
pnpm install
cp .env.example .env
```

Fill in `.env` with development-only values. Generate the Prisma client and start the app:

```bash
pnpm db:generate
pnpm dev
```

### Optional demo data

The seed command deletes existing application data. Use it only with a disposable database, set `ALLOW_DB_RESET=true`, and provide a unique `SEED_ADMIN_PASSWORD`:

```bash
pnpm db:seed
```

Never reuse demo credentials in a shared or production environment.

## Validation

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm sim:balance
```

The full local release gate is:

```bash
pnpm release:check
```

Disposable browser tests mutate seeded state and therefore require an isolated database:

```bash
pnpm test:e2e:disposable
```

## Supabase security notes

- Keep `SUPABASE_SERVICE_ROLE_KEY` server-side and never expose it through a `NEXT_PUBLIC_` variable.
- Treat `prisma/migrations/*` and `supabase/rls.sql` as reviewed security-sensitive code.
- The seed script blocks production execution and requires explicit reset authorization.
- New deployments should review Data API exposure and verify RLS for every exposed table.

## Documentation

- [Change log](CHANGELOG.md)
- [Deployment runbook](docs/deployment-runbook.md)
- [Operations runbook](docs/operations-runbook.md)
- [Manual acceptance guide](docs/manual-acceptance.md)
- [Formula calibration](docs/formula-calibration.md)
- [Project introduction](docs/swufe-hotelsim-project-introduction.md)

## Community

- Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing changes.
- Report vulnerabilities privately according to [SECURITY.md](SECURITY.md).
- Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

Released under the [MIT License](LICENSE).
