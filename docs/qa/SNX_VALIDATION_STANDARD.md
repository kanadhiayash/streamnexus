# SNX Validation Standard

## Purpose

`SNX` is the canonical short identifier for StreamNexus. It connects product work, automated tests, fixture identities, CI evidence, diagnostics, and audit events without exposing implementation details to end users.

This standard applies to all pivot work tracked by epic #32.

## Identifier contracts

| Purpose | Format | Example |
| --- | --- | --- |
| Workstream | `SNX-###` | `SNX-203` |
| Validation | `SNX-<AREA>-###` | `SNX-CAPACITY-003` |
| Automated test | `[SNX-<AREA>-###] expected behavior` | `[SNX-AUTH-001] member login persists after redirect` |
| Demo title fixture | `SNX-TITLE-###` | `SNX-TITLE-017` |
| CI display name | `SNX / <gate>` | `SNX / Validate identifiers` |
| Audit event | `SNX.<domain>.<event>` | `SNX.auth.login-succeeded` |

Identifiers are stable references. Renaming an identifier requires updating its registry entry, automated coverage, issue, PR evidence, and dependent documentation in the same branch.

## Approved validation areas

- `AUTH`
- `ACCESS`
- `CAPACITY`
- `FIXTURE`
- `IA`
- `UI`
- `A11Y`
- `SEC`
- `CI`
- `DATA`
- `PARTNER`
- `ADMIN`
- `RELEASE`
- `BRAND`

New areas require an issue-backed change to this document, the machine-readable registry, the validator, and tests.

## Registry

The source of truth is:

```text
docs/qa/snx-validation-registry.json
```

Each validation entry must contain:

- a unique valid `id`
- an `area` matching the ID
- a concise behavior-focused `title`
- an owning GitHub issue number
- a status

The validator rejects malformed IDs, duplicate IDs, area mismatches, incomplete fixture ranges, invalid patterns, and missing privacy controls.

Run:

```bash
npm run snx:validate
```

## Automated test naming

Tests added for SNX work must use this structure:

```js
test('[SNX-AREA-###] expected behavior', () => {
  // behavior-focused assertion
});
```

Rules:

1. One validation ID maps to one clearly stated behavior.
2. A test title describes an observable outcome, not an implementation detail.
3. Reusing one ID across multiple files requires an explicit reason in the owning PR.
4. Tests must not include credentials, private user data, tokens, session IDs, or proprietary payloads.
5. Existing pre-SNX tests remain valid until touched by a planned workstream.

## NPM aliases

The canonical aliases are:

```bash
npm run snx:test
npm run snx:validate
npm run snx:verify
```

They wrap existing gates rather than replace them:

- `snx:test` runs the current test suite.
- `snx:validate` validates the SNX registry and identity rules.
- `snx:verify` validates SNX identity, then runs the existing release verification gate.

## Fixture identity

The reserved demo-title range is exactly:

```text
SNX-TITLE-001
...
SNX-TITLE-050
```

Rules:

- The range contains 50 IDs with no gaps or duplicates.
- Fixture IDs are stable across seed, repair, reset, screenshots, and tests.
- Fixture IDs are internal evidence identifiers and should not become public display titles.
- Non-demo records must never receive an `SNX-TITLE-*` fixture identity.

## CI identity

CI workflow, job, and step display text use the `SNX /` prefix. PRs targeting `dev` must run the `SNX / CI` workflow and its `SNX / verify` job. Release PRs from `dev` to `main` must run `SNX / Release Verification`.

Required-check migration note for #44:

- Previous required check display: `verify`
- New required check display: `SNX / verify`
- Keep `verify` as the YAML job identifier while branch protection is updated to the new display name.
- `main` remains review-gated; CI changes do not enable automatic merge to `main`.

CI hardening rules:

- Use `permissions: contents: read` by default.
- Grant `security-events: write` only to CodeQL analysis.
- Use `pull_request`, not `pull_request_target`, for untrusted PR verification.
- Pin third-party actions to full commit SHAs.
- Cancel superseded runs with workflow concurrency.
- Publish only non-sensitive artifacts that exclude environment values, credentials, secrets, tokens, cookies, and private payloads.
- Keep repository-setting-dependent checks, such as GitHub dependency review, outside the required gate until the matching repository feature is enabled. `npm audit --audit-level=moderate` remains the required dependency gate.

## Diagnostics and audit events

Audit events use:

```text
SNX.<domain>.<event>
```

Examples:

```text
SNX.auth.login-succeeded
SNX.access.confirmed
SNX.capacity.reconciled
```

Do not include these fields in diagnostic or audit payloads unless a later reviewed security design explicitly provides an irreversible safe representation:

- email
- password
- token
- cookie
- session ID
- authorization header

Validation IDs may appear in internal logs, CI output, test evidence, and PRs. They must not replace clear user-facing messages.

## PR evidence

Every SNX implementation PR must include:

- workstream ID
- implemented validation IDs
- exact test and verification commands
- changed-file inventory
- security and accessibility impact
- risks and rollback
- issue closure keyword

## Change control

This standard is additive. Do not delete or recycle a validation ID after it has shipped. Mark obsolete behavior as superseded in the registry and introduce a new ID for materially different behavior.
