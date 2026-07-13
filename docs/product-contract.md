# StreamNexus Product Contract

**Workstream:** SNX-102 curated screening and access-platform contract
**Status:** Source of truth for pivot implementation
**Base branch:** `dev`
**Owner issue:** #35

## Product Definition

StreamNexus is a role-based curated screening and access platform prototype.

The product helps guests discover a fictional entertainment catalog, helps members request and manage limited access to eligible titles, helps partners understand how programs and release windows are represented, and helps administrators operate catalog, access, member, partner, and audit workflows. The product identity is:

```text
DISCOVER • CONNECT • ACCESS
```

StreamNexus does not process real payments, stream protected media, prove commercial licensing, manage real partner contracts, or claim production users.

## Roles And Permissions

| Role | Purpose | Allowed actions | Explicit limits |
| --- | --- | --- | --- |
| Guest | Public visitor evaluating the catalog and product promise. | View public discovery pages, inspect published title summaries, sign in, create a member account. | Cannot request access, see member inventory, manage partners, or access admin tools. |
| Member | Authenticated viewer with access entitlements. Compatible with legacy `streamer` accounts until migration completes. | Browse published titles, save titles, review access terms, request access when seats are available, view active access, return access, view history, manage account security. | Cannot create administrator accounts, bypass access limits, see other members' entitlements, or manage catalog metadata. |
| Partner | Future authenticated organization or program owner. | Review partner-owned titles, programs, collections, release windows, and access policy summaries. | Not implemented in runtime yet. Partner routes and writes remain out of scope until #40 and #50. |
| Administrator | Privileged operator for the prototype. | Manage titles, programs, collections, partner records, release windows, access policies, member status, access entitlements, capacity, and audit evidence. | Cannot use public signup. Must not publish unverified production claims or expose sensitive diagnostics. |

Public registration creates member-compatible accounts only. Administrator and future partner access are controlled operations, not public signup outcomes.

## Canonical Vocabulary

| Canonical term | Definition | Legacy compatibility |
| --- | --- | --- |
| Title | A fictional movie or series catalog record. | Current code and data may still use `Content`. |
| Program | A curated group of titles tied to a partner, theme, or screening initiative. | New domain, not currently implemented. |
| Collection | Public or member-facing grouping used for discovery. | Current landing rails and catalog filters are compatibility surfaces. |
| Partner | Organization or owner associated with a program, title set, or release window. | New domain, not currently implemented. |
| Release Window | Time-bounded availability rule for a title, program, or collection. | Current `available` boolean is a compatibility approximation. |
| Access Policy | Rules that decide who can request access, how many seats exist, and what happens at expiry or return. | Current `rentalLimit` and availability checks are compatibility inputs. |
| Access Entitlement | A member-specific right to access a title for a limited time. | Current `Rental` records are the compatibility backing model. |
| My List | Member-saved titles. | Current `shortlist` is the compatibility backing field. |
| Return Access | Member action that releases an active entitlement. | Current checkout or completed-rental flow maps to this until renamed. |

Avoid presenting rental as the primary business identity. Rental terminology may remain in code, routes, tests, or data only as documented compatibility while migration work is underway.

## Included Scope

- Public discovery, catalog, title detail, and access explanation.
- Member registration, login, My List, access review, access confirmation, active access, access history, return access, and account security.
- Partner vocabulary and boundaries for later implementation.
- Administrator overview, catalog lifecycle, program, collection, partner, release-window, access-policy, entitlement, member, and audit operations.
- Credential-free sandbox runtime with deterministic fictional fixtures.
- 50-title fictional demo catalog target using reserved `SNX-TITLE-001` through `SNX-TITLE-050` identifiers.
- 20-seat default demo capacity for issue-backed access-policy work.
- Modular server-rendered monolith architecture.
- Compatibility migration from rental/content/streamer wording to title/access/member wording.
- Security, accessibility, browser, concurrency, and release verification gates.

## Excluded Scope

- Real payment processing.
- Protected media playback or DRM.
- Real partner agreements, licensing proof, refunds, ads, reviews, AI recommendations, creator uploads, or native apps.
- React, Next.js, GraphQL, microservices, or a separate SPA.
- Production deployment or compliance certification.
- Public metrics, screenshots, videos, partner claims, or performance claims without current evidence.

## Access State Machines

### Title Lifecycle

```text
draft -> scheduled
scheduled -> published
published -> unpublished
unpublished -> scheduled
unpublished -> published
draft -> archived
scheduled -> archived
published -> archived
unpublished -> archived
archived -> restored as draft or unpublished
```

Archived titles do not appear in public discovery. Published titles still require an active release window and access policy before members can request access.

### Release Window

```text
draft -> scheduled
scheduled -> active
active -> ended
scheduled -> cancelled
active -> cancelled
ended -> archived
cancelled -> archived
```

Ended and cancelled windows do not grant new access. Existing active entitlements follow their access policy unless an administrator cancels them.

### Access Entitlement

```text
requested -> active
requested -> denied
active -> returned
active -> expired
active -> cancelled
```

Returned, expired, cancelled, and denied are terminal. Terminal states never return to active.

### Account

```text
active -> suspended
suspended -> active
active -> deleted
suspended -> deleted
```

Deleted is terminal for authentication. Historical audit evidence must remain public-safe and minimize personal data.

## Route And Compatibility Contract

The target information architecture uses public, member, partner, and administrator surfaces:

| Surface | Target examples | Current compatibility |
| --- | --- | --- |
| Public | `/`, `/browse`, `/titles/:slug`, `/login`, `/signup` | Current public home and `/content/:id` JSON route remain compatibility surfaces. |
| Member | `/member/home`, `/member/my-list`, `/member/access`, `/member/access/:reference`, `/member/account` | Current `/streamer/*` routes remain member-compatible until route migration. |
| Partner | `/partner/programs`, `/partner/titles`, `/partner/release-windows` | Documented for #40 and #50. Not runtime scope for #35. |
| Administrator | `/admin`, `/admin/catalog`, `/admin/programs`, `/admin/partners`, `/admin/access`, `/admin/members`, `/admin/audit` | Current `/admin/dashboard` and `/admin/content` remain compatibility routes. |

Issue #31 is superseded by this route contract for future pivot work. Its authenticated-home behavior remains valid compatibility evidence, but future route naming and page-state decisions must follow the public/member/partner/admin model above.

## Public-Safe Claims

StreamNexus may be described as a portfolio prototype once the described behavior is verified in the current worktree. Public copy must not claim:

- hosted production deployment unless deployed and verified
- real users
- real partner participation
- real payment processing
- real media playback
- real licensing, legal clearance, or compliance certification
- final screenshots or video before release and capture approval
- production scale from local load tests

## Validation Coverage

Issue #35 owns these validation IDs:

- `SNX-DATA-001` canonical domain vocabulary is complete
- `SNX-IA-001` public and authenticated surfaces are distinct
- `SNX-ACCESS-001` entitlement states are defined
- `SNX-PARTNER-001` partner ownership boundaries are defined
- `SNX-RELEASE-001` public claims remain evidence-bounded

Future implementation workstreams must add runtime tests for the relevant IDs when they move from documented contract to behavior.

## Capture Blocker

Final screenshots, GIFs, video, portfolio promotion, and `main` release remain blocked until the release verification and capture gates pass on a verified `dev` commit and Yash approves the final merge path.
