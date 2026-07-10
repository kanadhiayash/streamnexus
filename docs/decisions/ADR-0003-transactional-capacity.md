# ADR-0003: Transactional Licence Capacity

**Status:** Proposed
**Date:** 2026-07-10
**Owners:** Yash Kanadhia, Codex
**Related stage:** S0

## Context

Current rental creation checks active rental count before creating a rental. That creates a race risk for finite licence seats.

## Facts

- Current `createRental` reads content, counts active rentals, checks duplicate active rental, creates a rental, then appends content to `User.rented`.
- Current capacity display counts active rentals once per title.
- Current rental lifecycle has `active` and `completed`, not returned, expired, or cancelled.
- Rental confirmation has no idempotency key.

## Decision

Licence reservation and release must be atomic or equivalently concurrency-safe.

Target confirmation:

```text
validate request
-> authenticate member
-> authorize active account
-> resolve idempotency record
-> reconcile stale rentals for title
-> ensure title is published
-> ensure no duplicate active rental
-> ensure member active-rental limit
-> reserve one licence atomically
-> create rental with snapshots
-> write audit event
-> commit
-> return canonical rental
```

Return, expiry, and admin cancellation release one licence exactly once.

## Options Considered

### Keep count-before-create

Rejected because it can oversubscribe under concurrent requests.

### Maintain `activeLicenceCount` projection transactionally

Accepted as the preferred target when transaction support is available.

### Page-level aggregate counts only

Useful for reads, but insufficient as the write-side invariant.

## Consequences

Positive:

- Prevents last-seat race bugs.
- Makes retry behavior testable.
- Replaces N+1 count reads over time.

Negative:

- Requires migration, compatibility, and transaction-topology validation.
- Requires concurrency tests that are more complex than current integration tests.

## Security and Privacy

Idempotency keys must be hashed before storage and scoped to member and operation.

## Accessibility

Capacity conflicts must return accessible, non-colour-only status and recovery copy.

## Data and Migration

`Title.activeLicenceCount` is an operational projection. `Rental` remains the historical source of truth.

## Testing

Required scenarios include last-seat race, duplicate idempotency key, duplicate active rental, double return, expiry/return race, admin cancel/member return race, and active-overage policy.

## Rollback or Replacement Condition

If target deployment cannot support MongoDB transactions, S5 must propose an equivalent atomic update strategy before implementation.

## Evidence

See `docs/current-state-inventory.md` and `docs/traceability.md`.
