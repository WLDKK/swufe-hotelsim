# Check a HotelSim deployment

Use Node.js 22 or later. No dependency installation, account, or database credentials are required:

```sh
node --test scripts/check-deployment.test.mjs
node scripts/check-deployment.mjs https://your-canonical-hotel-domain
```

The check reads the homepage, login page, Auth.js providers and anonymous session endpoint. It rejects platform errors, unrelated pages, and authentication URLs that point to a different origin. Run it against the canonical hotel domain; an intentional alias can report an origin mismatch.

Passing this check does not prove database-backed login, email delivery, simulation settlement, or multiplayer capacity. Those require separate authenticated verification.

## When the homepage works but login redirects elsewhere

1. Open `/api/auth/providers` on the hotel domain and inspect `signinUrl` and `callbackUrl`.
2. In the hosting project's production environment settings, set `AUTH_URL` and `NEXTAUTH_URL` consistently to the intended canonical hotel origin. Keep existing authentication secrets and database settings unchanged.
3. Redeploy the intended, reviewed application version so it reads the updated environment.
4. Re-run the command above, then verify sign-in with an authorized test account.

Do not replace secrets, reset the database, or merge unrelated dependency major upgrades to fix a domain mismatch. If a hosting connector cannot list the existing project, verify its account, team and project access first; an inaccessible management API does not establish that the public deployment is stopped.
