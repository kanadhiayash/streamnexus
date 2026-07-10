# ADR-0001: Product Contract

**Status:** Proposed
**Date:** 2026-07-10
**Owners:** Yash Kanadhia, Codex
**Related stage:** S0

## Context

The current app mixes streaming, rental, checkout, completion, streamer, content, shortlist, and watch-history language. Those terms imply different products and make later code, UI, data, and release claims harder to verify.

## Facts

- Current public copy calls StreamNexus a streaming rental prototype.
- Public signup creates a `streamer`.
- The product does not process real payments or stream protected media.
- Rentals are stored in `Rental`, but `User.rented` duplicates part of that state.

## Decision

StreamNexus is a role-based digital entertainment rental prototype.

Use the target vocabulary: guest, member, administrator, title, My List, rental confirmation, active rental, return access, and licence availability.

Do not claim payment processing, playback, production users, compliance, final screenshots, or recorded demo video unless verified in the current release gate.

## Options Considered

### Keep streaming vocabulary

Rejected because it implies playback and conflicts with the current no-playback product boundary.

### Reposition as a rental prototype

Accepted because it matches finite licence capacity, simulated rental confirmation, and the upgrade plan.

### Expand into full OTT platform

Rejected for this upgrade because it would require playback, DRM, licensing, and production-level concerns outside portfolio scope.

## Consequences

Positive:

- Gives every stage one product model.
- Makes public copy safer.
- Sets clear route, data, and UI naming direction.

Negative:

- Requires later code, route, view, test, and README vocabulary changes.
- Existing `streamer` naming must remain documented until changed safely.

## Security and Privacy

Public registration must create member accounts only. Admin creation remains controlled and out of public signup.

## Accessibility

Product vocabulary must be consistent in headings, labels, errors, and status text.

## Data and Migration

`streamer` maps to `member` during compatibility migration. `content` maps to `title`. Embedded shortlist and rented arrays stop being active sources of truth after migration evidence.

## Testing

Later stages must add tests proving public signup cannot create admin roles, user-facing language matches target contract, and README claims match verified behavior.

## Rollback or Replacement Condition

Replace this decision only if the product is explicitly re-scoped to playback, payments, subscriptions, or another business model.

## Evidence

See `docs/product-contract.md`, `docs/current-state-inventory.md`, and `docs/qa/s0-baseline-evidence.md`.
