# Contributing

Thank you for helping improve SWUFE HotelSim.

## Before you start

1. Search existing issues and discussions before opening a new proposal.
2. For a substantial change, open an issue describing the problem, intended users, and proposed approach.
3. Keep pull requests focused and avoid unrelated formatting or dependency changes.

## Development workflow

```bash
pnpm install
pnpm db:generate
pnpm test
pnpm typecheck
pnpm lint
```

Run `pnpm release:check` before requesting review. End-to-end tests that change database state must use a disposable environment.

## Pull requests

- Explain the user or maintainer impact.
- Add or update tests for behavior changes.
- Update documentation and the change log when appropriate.
- Do not commit `.env` files, credentials, student records, production exports, or database dumps.
- Use synthetic examples and reserved domains such as `hotelsim.example`.

By contributing, you agree that your contribution is licensed under the repository's MIT License.
