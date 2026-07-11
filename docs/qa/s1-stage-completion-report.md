# S1 Stage Completion Report

## Objective

Add a credential-free sandbox runtime without starting a broader architecture rewrite.

## Repository State

```text
Branch: chore/streamnexus-sandbox-runtime
Base branch: dev
Commit before: 8d0f6b974e5fa9147b7f38330b5cffcdcb0354f4
Commit after: pending local commit
Working tree: S1 sandbox changes plus untracked handoff input folder
```

## Facts

- S0 is merged into `dev`.
- Sandbox uses `mongodb-memory-server`.
- Sandbox session storage is in-memory because `connect-mongo` is skipped when `APP_RUNTIME=sandbox`.
- Sandbox binds to `127.0.0.1`.
- Sandbox rejects remote MongoDB URIs.
- Sandbox seeds deterministic fictional local accounts.
- `/health` returns safe runtime status and does not include secrets or connection strings.
- The unused direct `npm` dependency was removed because it was the S0 audit blocker and no code imported it.

## Assumptions

- The existing seeded demo credentials remain acceptable for S1 because the stage is local-only and deterministic.
- Full separation of demo fixtures from auth controller remains S2/S3 work.
- Full production config validation remains S2 work.

## Files Changed

- `app.js`
- `config/db.js`
- `package.json`
- `package-lock.json`
- `scripts/sandbox.js`
- `scripts/sandbox-smoke.js`
- `test/sandbox.test.js`
- `docs/qa/s1-stage-completion-report.md`

## Behavior Changed

- `npm run sandbox` starts StreamNexus with ephemeral MongoDB, in-memory session storage, local-only binding, and deterministic seed data.
- `npm run sandbox:smoke` checks health, member login and browse, admin login and catalog access, then shuts down server and memory database.
- `GET /health` returns safe JSON status.
- The dependency audit now passes with 0 vulnerabilities.

## Behavior Intentionally Unchanged

- Existing development and production-capable startup still use configured MongoDB and `connect-mongo`.
- Current routes, role names, views, and rental behavior remain unchanged.
- The app still uses the existing auth-controller seed function until later stages move fixtures into a dedicated demo module.

## Tests Added or Updated

- Added `test/sandbox.test.js` for remote MongoDB URI rejection in sandbox.
- Added syntax checks for sandbox scripts.

## Commands and Observed Results

| Command | Exit status | Result |
| --- | ---: | --- |
| `npm install` | 0 | Removed unused `npm` dependency chain; 0 vulnerabilities. |
| `npm run sandbox:smoke` | 0 | Health, streamer browse, and admin catalog smoke passed. |
| `npm test` | 0 | 10 tests passed. |
| `npm run test:ejs` | 0 | 14 templates compiled. |
| `npm audit --audit-level=moderate` | 0 | 0 vulnerabilities. |
| `npm run scan:secrets` | 0 | No tracked secret-pattern matches found. |
| `npm run test:load` | 0 | 200 local requests passed thresholds: average 2 ms, p95 3 ms, max 11 ms. |
| `git diff --check` | 0 | No whitespace errors. |

## Security Review

Sandbox rejects remote MongoDB URIs, does not require real credentials, uses in-memory sessions, and exposes only safe health metadata. Removing the unused direct `npm` dependency clears the audit blocker without weakening controls.

## Accessibility Review

No UI changes. Existing server-rendered flows remain the baseline for later accessibility work.

## Data Migration and Rollback

No migration ran. Sandbox data is ephemeral and discarded on shutdown. Rollback is to remove sandbox scripts and revert the app/runtime changes.

## Documentation Updated

Added this S1 completion report.

## Unknowns

- Whether future deployment topology supports MongoDB transactions.
- Whether later demo fixtures should change account names during member vocabulary migration.

## Risks

- Sandbox still reuses the existing seed function in `authController`; this is acceptable for S1 but should move during S2/S3.
- CI currently does not trigger on PRs into `dev`.

## Definition-of-Done Review

- [x] Scope remained bounded
- [x] Acceptance criteria passed
- [x] Tests are current
- [x] Documentation is current
- [x] No secret appeared
- [x] No unexplained failure remains
- [x] Rollback or forward-fix is documented
- [x] Claims have observed evidence

## Recommended Next Stage

S2: application composition and dependency injection.

## Actions Requiring Human Approval

- push: `chore/streamnexus-sandbox-runtime`
- issue: create/track S1 issue
- pull request: open S1 PR into `dev`
- merge: merge S1 PR into `dev`
- close issue: close S1 issue after merge
- deploy: none
- publish media: none
