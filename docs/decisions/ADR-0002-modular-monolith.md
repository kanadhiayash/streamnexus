# ADR-0002: Server-Rendered Modular Monolith

**Status:** Proposed
**Date:** 2026-07-10
**Owners:** Yash Kanadhia, Codex
**Related stage:** S0

## Context

The current app is inspectable and portfolio-friendly, but `app.js` and several controllers/services own mixed responsibilities. The upgrade needs clearer boundaries without changing the whole stack.

## Facts

- Current stack is Node.js, CommonJS, Express 5, EJS, vanilla CSS, vanilla browser JavaScript, MongoDB, Mongoose, and session authentication.
- Existing tests use the Node test runner, Supertest, and `mongodb-memory-server`.
- The handoff package rejects React, Next.js, GraphQL, microservices, and a separate SPA for this upgrade.

## Decision

Keep StreamNexus as a server-rendered modular monolith.

Target flow:

```text
Browser
-> Express route
-> input validation
-> controller
-> use case
-> repository
-> Mongoose model
-> MongoDB
-> domain result
-> EJS, redirect, or JSON
```

## Options Considered

### Keep current MVC/service shape unchanged

Rejected because later sandbox, migration, auth, rental consistency, and release testing need stronger seams.

### Server-rendered modular monolith

Accepted because it preserves the current stack while creating testable boundaries.

### SPA/API or microservices rewrite

Rejected because it adds scope and weakens evidence discipline for this portfolio upgrade.

## Consequences

Positive:

- Preserves current app strengths.
- Enables module-by-module migration.
- Keeps primary journeys working without browser JavaScript.

Negative:

- Requires disciplined staged refactoring.
- Requires compatibility tests during boundary migration.

## Security and Privacy

Use cases must enforce role and ownership checks, not only route middleware.

## Accessibility

Server-rendered HTML remains the baseline. Browser JavaScript may enhance interactions but cannot be required for primary flows.

## Data and Migration

Repositories become the persistence boundary during S3 and S4. No generic base repository or DI framework is approved.

## Testing

Characterization tests must protect existing behavior before moving modules.

## Rollback or Replacement Condition

Replace only with an approved ADR that proves another architecture better supports the same product contract and evidence gates.

## Evidence

See `docs/architecture-target.md`.
