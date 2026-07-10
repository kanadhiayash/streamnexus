# ADR-0004: Credential-Free Sandbox

**Status:** Proposed
**Date:** 2026-07-10
**Owners:** Yash Kanadhia, Codex
**Related stage:** S0

## Context

The current README requires local MongoDB or an Atlas connection string. The upgrade needs a repeatable sandbox that works without `.env`, shared databases, or real credentials.

## Facts

- `mongodb-memory-server` is already a dev dependency.
- Tests already use in-memory MongoDB.
- Current normal startup defaults to `mongodb://127.0.0.1:27017/streamnexus` and a development session-secret fallback outside production.
- Demo seeding currently lives in the auth controller and can run during non-production startup.

## Decision

Add an explicit credential-free sandbox runtime in S1.

Sandbox must use ephemeral MongoDB, in-memory sessions, deterministic fictional fixtures, generated local-only session secret, loopback binding, no external services, safe health response, and graceful shutdown.

## Options Considered

### Keep local MongoDB or Atlas requirement

Rejected because clean clone execution and public-safe capture need no real backend credentials.

### Add sandbox profile

Accepted because it supports repeatable QA, demos, and capture without shared data risk.

### Mock persistence only

Rejected because rental and migration behavior require real database semantics.

## Consequences

Positive:

- Clean clone can run without `.env`.
- Demo evidence can use deterministic fictional data.
- Capture and tests avoid shared data.

Negative:

- Requires app composition changes in S1/S2.
- Requires clear separation between sandbox seed and production-capable runtime.

## Security and Privacy

Sandbox must reject remote database URIs and must not use or store real credentials.

## Accessibility

Sandbox must seed enough deterministic state for primary accessibility and browser journeys.

## Data and Migration

Sandbox data is disposable and fictional. Migration tests use deterministic fixtures and must not connect to shared databases.

## Testing

S1 must add `npm run sandbox` and `npm run sandbox:smoke`.

## Rollback or Replacement Condition

Replace only if another credential-free runtime can provide equivalent database semantics and deterministic seed behavior.

## Evidence

See `docs/qa/s0-baseline-evidence.md`.
