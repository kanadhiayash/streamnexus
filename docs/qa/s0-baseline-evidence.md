# S0 Baseline Evidence

**Stage:** S0 product contract and traceability
**Date:** 2026-07-10
**Repository:** `/Users/yashkanadhia/Documents/Dev-Projects/FULL-STACK/streamnexus`

## Repository State

| Check | Result |
| --- | --- |
| Starting branch | `dev` |
| S0 branch | `docs/streamnexus-product-contract` |
| Commit | `c3e369460f23d397e84e358527ac576284bd82ba` |
| Worktree before S0 edits | untracked `streamnexus-codex-handoff-2026-07-10/` |
| Handoff package checksum | passed from package directory |
| Node.js | `v24.14.0` |
| npm | `11.9.0` |

Note: `git switch -c docs/streamnexus-product-contract dev` returned `fatal: a branch named 'docs/streamnexus-product-contract' already exists` because the local branch already existed. Work continued on that branch.

## Baseline Commands

| Command | Exit status | Result |
| --- | ---: | --- |
| `npm ci` | 0 | Installed 165 packages. npm reported one high severity vulnerability in install summary. |
| `npm test` | 0 | Syntax and integration tests passed: 9 tests, 9 pass. Negative-path tests logged expected CSRF and forbidden-route errors. |
| `npm run test:ejs` | 0 | Compiled 14 EJS templates. |
| `npm audit --audit-level=moderate` | 1 | Failed on high severity `undici <=6.26.0` advisories through `node_modules/npm/node_modules/undici`. |
| `npm run scan:secrets` | 0 | No tracked secret-pattern matches found. |
| `npm run test:load` | 0 | 40 iterations, 200 requests, average 2 ms, p95 5 ms, max 45 ms against local thresholds. |

## Audit Failure Detail

`npm audit --audit-level=moderate` failed because the repo directly depends on `npm` and that dependency currently pulls a vulnerable `undici` version.

Reported advisories:

- `GHSA-p88m-4jfj-68fv`
- `GHSA-vxpw-j846-p89q`
- `GHSA-35p6-xmwp-9g52`
- `GHSA-g8m3-5g58-fq7m`

Likely next fix: assess whether the direct `npm` runtime dependency is needed. If not needed, remove it in a dedicated dependency/security stage. If needed, update to a non-vulnerable version and rerun the audit.

## Confirmed Drift

- No commit drift from handoff package baseline.
- Live app includes `GET /content/:id`, which the handoff current-state route table omitted.
- README currently reserves 7 screenshot paths, while the handoff S13 capture plan reserves 10 screenshot paths.
- Current CI triggers pushes to `main` and `chore/**`, and pull requests to `main`; staged branches targeting `dev` will not get the same PR trigger unless CI is updated.
- `package.json` version is `1.0.0`; the handoff README says package version `2.0`, which appears to be handoff package metadata rather than live app version.

## Exact Proposed S1 Scope

S1 should implement only credential-free sandbox runtime:

- explicit sandbox runtime profile
- `mongodb-memory-server` startup
- in-memory sessions
- deterministic fictional fixtures outside authentication controller
- rejection of remote database URIs in sandbox
- generated local-only session secret
- loopback binding
- safe `/health`
- graceful shutdown
- `npm run sandbox`
- `npm run sandbox:smoke`

S1 must not perform the full app composition refactor, data migration, UI redesign, payment, playback, or public media capture.

## Actions Requiring Approval

- create GitHub issue for S0
- push `docs/streamnexus-product-contract`
- open a pull request into `dev`
- merge into `dev`
- close the S0 issue after merge
- start S1 branch
