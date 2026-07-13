# ADR-0001: Product Contract

**Status:** Superseded by SNX-102 pivot contract
**Date:** 2026-07-10
**Updated:** 2026-07-13
**Owners:** Yash Kanadhia, Codex
**Related issues:** #35, #32

## Context

The first S0 contract described StreamNexus as a role-based digital entertainment rental prototype. That contract matched the then-current implementation, but epic #32 now pivots the product toward a curated screening and access-platform identity.

The older rental-first language is no longer the product source of truth. It remains useful only as compatibility context because the current runtime still contains `streamer`, `content`, `rental`, `shortlist`, and checkout naming.

## Facts

- The approved product code is `SNX`.
- The approved brand identity uses `DISCOVER • CONNECT • ACCESS`.
- The current runtime still has legacy rental/content/streamer routes and data names.
- The pivot backlog requires partner, program, collection, release-window, access-policy, and entitlement concepts.
- The product does not process real payments, stream protected media, prove licensing, or claim production users.

## Decision

StreamNexus is a role-based curated screening and access platform prototype.

Use the canonical vocabulary: guest, member, partner, administrator, title, program, collection, release window, access policy, access entitlement, My List, and return access.

Treat rental/content/streamer terminology as compatibility wording until issue-backed route, data, and UI migrations replace it. Do not silently remove compatibility paths.

Do not claim payment processing, playback, real partner participation, production users, compliance, final screenshots, or recorded demo video unless verified in the current release gate.

## Options Considered

### Keep the rental prototype identity

Rejected because the pivot epic, brand identity, and future partner/access backlog need a broader access-platform model.

### Reposition as a curated screening and access platform

Accepted because it matches the approved identity, limited-seat access model, partner/program roadmap, and public-safe prototype boundary.

### Expand into a full OTT or streaming platform

Rejected because it would imply playback, DRM, licensing, production infrastructure, and compliance claims outside this upgrade.

## Consequences

Positive:

- Aligns product language with `DISCOVER • CONNECT • ACCESS`.
- Gives later backend, UI, IA, and validation work one contract.
- Preserves compatibility instead of breaking current routes or tests.
- Creates room for partner and release-window implementation without overclaiming.

Negative:

- Requires later code, route, view, test, README, and data vocabulary changes.
- Existing rental-first code remains temporarily inconsistent until issue-backed migrations land.
- Future PRs must be checked against this contract to avoid drift.

## Security and Privacy

Public registration creates member-compatible accounts only. Administrator and future partner access remain controlled operations. Diagnostics and audit evidence must not expose credentials, tokens, sessions, or direct personal identifiers.

## Accessibility

Product vocabulary must be consistent in headings, labels, errors, status text, and navigation. Brand and access wording must not depend on color alone.

## Data and Migration

Compatibility mappings:

- `streamer` maps to member.
- `content` maps to title.
- `Rental` maps to access entitlement.
- `rentalLimit` maps to access-policy seat limit.
- `available` maps to title lifecycle plus release-window availability.
- `shortlist` maps to My List.

## Testing

Issue #35 adds document-level contract tests for `SNX-DATA-001`, `SNX-IA-001`, `SNX-ACCESS-001`, `SNX-PARTNER-001`, and `SNX-RELEASE-001`. Later implementation workstreams must add runtime tests when behavior moves from documentation to code.

## Rollback or Replacement Condition

Replace this decision only if Yash explicitly re-scopes StreamNexus to playback, payments, subscriptions, or another business model.

## Evidence

See `docs/product-contract.md`, `docs/traceability.md`, `docs/current-state-inventory.md`, and `docs/qa/snx-validation-registry.json`.
