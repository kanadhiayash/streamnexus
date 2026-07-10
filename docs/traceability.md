# StreamNexus Traceability

**Stage:** S0 product contract and traceability
**Status:** Proposed source of truth

## Required Chain

Every material feature must preserve this path:

```text
User need
-> Page
-> UI action
-> Route
-> Input schema
-> Authentication
-> Authorization
-> Use case
-> Repository
-> MongoDB operation
-> Domain result
-> UI state
-> Audit event
-> Automated test
```

Current implementation has routes, controllers, services, Mongoose models, views, and tests, but it does not yet have explicit input schemas, use-case boundaries, repository boundaries, audit events, or full page-state coverage.

## Canonical Data Ownership

| Concept | Current source | Target source |
| --- | --- | --- |
| Account identity and role | User | User |
| Account status | Missing | User |
| Saved title | User.shortlist | SavedTitle |
| Catalog metadata | Content | Title |
| Title lifecycle | Content.available | Title.lifecycle |
| Licence limit | Content.rentalLimit | Title.licenceLimit |
| Active licence count | Runtime count per title | Title.activeLicenceCount projection |
| Active and historical rental | Rental plus User.rented | Rental |
| Administrative action | Missing | AuditEvent |
| Session | Session store | Session store with sessionVersion checks |
| Password reset | Missing | PasswordResetToken or equivalent |
| Rental policy | Constants in rental service | Versioned config plus rental snapshot |

## Guest And Member Target Matrix

| Need | Page | Route | Target use case | Primary evidence |
| --- | --- | --- | --- | --- |
| Understand product | Home | `GET /` | `getFeaturedCatalog` | Public home tests |
| Search titles | Browse | `GET /browse` | `searchPublishedTitles` | Search and injection tests |
| Inspect title | Details | `GET /titles/:slug` | `getPublishedTitle` | Hidden lifecycle tests |
| Create account | Signup | `POST /signup` | `registerMember` | Role escalation tests |
| Sign in | Login | `POST /login` | `authenticateMember` | Generic failure and session fixation tests |
| Save title | Details/card | `POST /member/my-list/:titleId` | `saveTitle` | Duplicate save tests |
| Remove saved title | My List | `POST /member/my-list/:titleId/remove` | `removeSavedTitle` | Repeated remove tests |
| Review rental | Review | `GET /member/titles/:slug/rental-review` | `prepareRentalReview` | Review-state tests |
| Confirm rental | Review | `POST /member/titles/:titleId/rent` | `confirmRental` | Race and retry tests |
| See active rentals | Rentals | `GET /member/rentals?status=active` | `listMemberRentals` | Pagination and ownership tests |
| See rental detail | Rental detail | `GET /member/rentals/:reference` | `getMemberRental` | Horizontal access tests |
| Return access | Rental detail | `POST /member/rentals/:reference/return` | `returnRental` | Double return tests |
| Change password | Account | `POST /member/account/password` | `changePassword` | Session invalidation tests |
| Revoke sessions | Account | `POST /member/account/sessions/revoke-others` | `revokeOtherSessions` | Revocation tests |
| Delete account | Account | `POST /member/account/delete` | `deleteAccount` | Terminal auth tests |

## Administrator Target Matrix

| Need | Page | Route | Target use case | Primary evidence |
| --- | --- | --- | --- | --- |
| Inspect health | Overview | `GET /admin` | `getAdminOverview` | Bounded aggregation tests |
| List catalog | Catalog | `GET /admin/catalog` | `searchAdminCatalog` | Lifecycle filter tests |
| Create draft | Editor | `POST /admin/catalog` | `createTitleDraft` | Validation tests |
| Preview | Preview | `GET /admin/catalog/:id` | `previewTitle` | Private lifecycle tests |
| Publish | Catalog | `POST /admin/catalog/:id/publish` | `publishTitle` | Transition and audit tests |
| Unpublish | Catalog | `POST /admin/catalog/:id/unpublish` | `unpublishTitle` | Transition and audit tests |
| Archive | Catalog | `POST /admin/catalog/:id/archive` | `archiveTitle` | History-preserved tests |
| Restore | Catalog | `POST /admin/catalog/:id/restore` | `restoreTitle` | Restore-state tests |
| Change licence limit | Editor | `PUT /admin/catalog/:id` | `changeLicenceLimit` | Active-overage tests |
| List rentals | Rentals | `GET /admin/rentals` | `searchRentals` | Minimized joins tests |
| Cancel rental | Rental detail | `POST /admin/rentals/:reference/cancel` | `cancelRental` | Exact-once release tests |
| List members | Members | `GET /admin/members` | `searchMembers` | Data minimization tests |
| Suspend member | Member detail | `POST /admin/members/:id/suspend` | `suspendMember` | Login and rent denial tests |
| Reactivate member | Member detail | `POST /admin/members/:id/reactivate` | `reactivateMember` | Restored access tests |
| Inspect audit | Audit | `GET /admin/audit` | `searchAuditEvents` | Metadata allowlist tests |

## Page State Requirements

Each primary page must document and test applicable states:

- loading
- empty
- populated
- validation error
- unauthorized
- forbidden
- not found
- conflict
- rate limited
- success
- unavailable
- partial data failure
- full service failure

## Stage Mapping

| Stage | Traceability purpose |
| --- | --- |
| S0 | Establish product contract, state machines, route/data inventories, target evidence chain. |
| S1 | Make runtime credential-free and repeatable. |
| S2 | Separate application composition so tests and runtime profiles can be injected. |
| S3 | Add use-case and repository seams for traceable business behavior. |
| S4 | Move to canonical data ownership with migration evidence. |
| S5 | Make rental lifecycle atomic, idempotent, and concurrency-safe. |
| S6 | Harden auth, sessions, account status, reset foundation, and limiters. |
| S7 | Align public/member IA and vocabulary. |
| S8 | Implement rental review, confirmation, details, history, and return. |
| S9 | Implement admin lifecycle, rental, member, and audit operations. |
| S10 | Add accessible UI system and responsive remediation. |
| S11 | Add security regression suite. |
| S12 | Add release verification. |
| S13 | Add deterministic capture readiness. |
