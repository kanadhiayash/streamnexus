# StreamNexus Product Contract

**Stage:** S0 product contract and traceability
**Status:** Proposed source of truth
**Verified against commit:** `c3e369460f23d397e84e358527ac576284bd82ba`

## Product Definition

StreamNexus is a role-based digital entertainment rental prototype.

Members explore a curated title catalog, save titles, and activate time-limited rental access from a finite licence pool. Administrators manage title metadata, publication state, licence availability, member status, rentals, and audit history. Rental confirmation is simulated.

StreamNexus does not process real payments, stream protected media, prove commercial licensing, or claim production users.

## Roles

| Role | Current implementation | Target contract |
| --- | --- | --- |
| Guest | Unauthenticated visitor on `/`, `/login`, `/signup`, and `/content/:id` JSON | Public visitor who can browse published titles, inspect details, sign in, and create an account |
| Member | Currently named `streamer` in code, routes, views, tests, and README | Authenticated rental customer with My List, rental review, active rentals, history, and account settings |
| Administrator | Currently named `admin` | Privileged operator for catalog lifecycle, licence limits, rental operations, member status, and audit events |

Public registration must create only member accounts. Administrator access must never be available through public signup.

## Vocabulary

| Current wording | Target wording | Notes |
| --- | --- | --- |
| Streamer | Member | Do not rewrite user-facing copy until the runtime role transition is implemented. |
| Content | Title | Catalog records represent rentable entertainment titles. |
| Shortlist | My List | Saved-title ownership should move out of the User document. |
| Checkout | Rental confirmation or return access | Current checkout marks a rental completed; target flow separates review, confirmation, return, expiry, and cancellation. |
| Complete rental | Return access | Avoid implying payment settlement or playback completion. |
| Rental capacity | Licence availability | Capacity means finite digital licence seats. |
| Available boolean | Title lifecycle plus licence availability | Publication state and licence count must become separate concepts. |
| Rented array | Rental records | `Rental` must become the canonical rental source. |

## Included Scope

- Public home, catalog, title details, and rental explanation.
- Member registration, login, My List, rental review, confirmation, active rentals, history, return access, and account management.
- Administrator overview, catalog lifecycle operations, licence management, rental operations, member operations, and audit log.
- Credential-free sandbox runtime with deterministic fictional fixtures.
- Modular server-rendered monolith architecture.
- Compatibility migration from current models to canonical ownership.
- Security, accessibility, browser, concurrency, and release verification gates.

## Excluded Scope

- Real payment processing.
- Protected media playback or DRM.
- Subscription billing, refunds, social features, reviews, ads, AI recommendations, creator uploads, or native apps.
- React, Next.js, GraphQL, microservices, or a separate SPA.
- Production deployment or compliance certification.
- Public metrics, screenshots, videos, or performance claims without current evidence.

## State Machines

### Title

```text
draft -> published
published -> unpublished
unpublished -> published
draft -> archived
published -> archived
unpublished -> archived
archived -> restored as draft or unpublished
```

### Rental

```text
active -> returned
active -> expired
active -> cancelled
```

Terminal rental states never return to active.

### Account

```text
active -> suspended
suspended -> active
active -> deleted
suspended -> deleted
```

Deleted is terminal for authentication.

## Public-Safe Claims

StreamNexus may be described as a portfolio prototype once the described behavior is verified in the current worktree. Public copy must not claim:

- hosted production deployment unless deployed and verified
- real users
- real payment processing
- real media playback
- compliance certification
- final screenshots or video before S13 capture approval
- production scale from local load tests

## Capture Blocker

Final screenshots, GIFs, video, and portfolio promotion remain blocked until the release verification and capture gates pass on a verified commit.
