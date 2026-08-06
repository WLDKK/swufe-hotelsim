# Deployment Runbook

This runbook promotes SWUFE HotelSim to Cloudflare Workers with Supabase Postgres.

## Runtime architecture

- Next.js 15 App Router is packaged by `@opennextjs/cloudflare`.
- Cloudflare Workers runs the Node.js runtime with `nodejs_compat`.
- Prisma uses `@prisma/adapter-pg`. Workers use the `HYPERDRIVE` binding; local tools and migrations fall back to `DATABASE_URL`.
- Prisma migrations remain the schema source of truth; `supabase/rls.sql` is the auditable Data API policy layer.

## Required configuration

Copy `.env.example` for local work. Configure production secrets with `wrangler secret put`; never place them in `wrangler.jsonc`.

Required for the core runtime:

- `DATABASE_URL`, `DIRECT_URL`
- `AUTH_URL`, `AUTH_SECRET`
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- a Cloudflare Hyperdrive configuration bound as `HYPERDRIVE`

Configure SMTP, Turnstile, Supabase API, alert-delivery, and public demo variables only when those features are enabled. `ALLOW_DB_RESET` must remain false in shared environments.

## Database release

1. Back up the target database and record the current migration.
2. Run `pnpm db:validate` and `pnpm db:generate`.
3. Run `pnpm db:deploy` against the production direct connection.
4. Run `pnpm db:rls` if the Supabase Data API is enabled.
5. Do not run the seed command on production.

Migration `0004_competition_operations` adds the competition-level judge assignment boundary. Deploy it before using the competition operations console.

## Application verification

Run:

```bash
pnpm install --frozen-lockfile
pnpm release:check
```

`release:check` validates dependencies, Prisma generation, the production Next.js build, types, lint, unit/component/route tests, simulation balance, and the Cloudflare bundle.

OpenNext does not guarantee native Windows builds. Use WSL, Linux, macOS, or the Ubuntu GitHub Actions release workflow for `pnpm cf:build`.

## Cloudflare release

1. Authenticate: `pnpm exec wrangler login` or set `CLOUDFLARE_API_TOKEN`.
2. Confirm identity: `pnpm exec wrangler whoami`.
3. Create or verify the `HYPERDRIVE` binding for production Postgres. Keep its ID in `wrangler.jsonc`; credentials remain encrypted in Cloudflare.
4. Add runtime secrets with `pnpm exec wrangler secret put NAME`.
5. Build, relocate, validate, and deploy the OpenNext artifact. The GitHub workflow performs the first three steps before publishing the artifact.
6. Record the Worker version and deployment URL.

The source-controlled Worker configuration enables `nodejs_compat`, static assets, logs, and sampled traces. Do not add secret values under `vars`.

## Post-deploy checks

- `GET /api/health` returns `200` and reports `database: ready`.
- `/`, `/login`, and `/display` load without authentication.
- A student can open decisions and results.
- A teacher can inspect classes and process a prepared round.
- An admin can open `/admin/competitions`, assign a judge, and link a pending round.
- The assigned judge can score that result; an unassigned judge receives no class/result access.
- The public leaderboard and announcements expose no private account data.

## Rollback

Roll back the Worker to the previous Cloudflare version first. Prefer a forward-fix database migration over destructive SQL rollback. Never reset or reseed a shared database during incident response.

## Release evidence

Store the git commit, applied migrations, automated check summary, Worker version, `/api/health` response, and smoke-test log. Screenshots are optional and are not required for automated release evidence.
