# StreamNexus S0 Intake Inventory

**Stage:** Historical S0 product contract and traceability intake
**Verified against initial intake commit:** `c3e369460f23d397e84e358527ac576284bd82ba`

## Repository State at S0 Intake

- Product-contract branch at intake: `docs/pivot-access-platform-contract`
- Integration branch: `dev`
- Final review branch: `main`
- Handoff package checksum verification passed when run from the package folder.
- The intake commit matched the package audit baseline.
- The handoff package was an input artifact for audit only and should remain untracked.

## SNX-102 Pivot Inventory

The source-of-truth product contract now defines StreamNexus as a curated screening and access platform. Current runtime names remain compatibility surfaces:

| Runtime term | Target term | Inventory note |
| --- | --- | --- |
| Streamer | Member | Existing `/streamer/*` routes remain member-compatible until route migration. |
| Content | Title | Existing `Content` records back the fictional title catalog. |
| Shortlist | My List | Existing user-owned shortlist remains the compatibility source. |
| Rental | Access entitlement | Existing `Rental` records back limited member access. |
| Rental limit | Access-policy seat limit | Existing `rentalLimit` approximates 20-seat demo capacity work. |
| Available | Title lifecycle plus release-window availability | Existing boolean is too coarse for the target contract. |
| Checkout or complete rental | Return access | Existing flow releases compatibility access. |

Issue #31 is superseded by the SNX-102 route contract for future naming. Its authenticated-home behavior remains compatibility evidence only.

## Runtime Stack

- Node.js CommonJS application.
- Express 5, EJS, vanilla CSS, vanilla browser JavaScript.
- MongoDB and Mongoose.
- `express-session` with `connect-mongo` outside test mode.
- Helmet, custom CSRF middleware, `express-rate-limit`, `bcryptjs`.
- Node test runner, Supertest, `mongodb-memory-server`, local load script.

## Application Composition

`app.js` currently owns environment loading, MongoDB URI selection, session-secret fallback, demo-seed policy, Helmet, body parsing, method override, static files, EJS setup, session store configuration, request locals, CSRF, route registration, landing-page catalog queries, 404 handling, error middleware, database startup, demo seeding, and process startup.

This confirms the S2 need to separate app creation, infrastructure, route registration, middleware registration, and process startup.

## Route Inventory

### Public and Authentication

| Method | Route | Current behavior |
| --- | --- | --- |
| GET | `/` | Render guest landing with featured titles or redirect logged-in users by role. |
| GET | `/login` | Render login form. |
| POST | `/login` | Shared login limiter, authenticate, set session, redirect by role. |
| GET | `/signup` | Render signup form. |
| POST | `/signup` | Shared login limiter, create `streamer`, set session. |
| POST | `/logout` | Destroy server session and redirect. |
| GET | `/content/:id` | Return content JSON by ObjectId. This route was missing from the handoff route table and is confirmed current drift. |

### Administrator

All admin routes are guarded by authentication and `admin` role middleware.

| Method | Route | Current behavior |
| --- | --- | --- |
| GET | `/admin/dashboard` | Dashboard with content, rental stats, and capacity display. |
| GET | `/admin/content` | List all content. |
| GET | `/admin/content/new` | Render create form. |
| POST | `/admin/content` | Create content. |
| GET | `/admin/content/:id/edit` | Render edit form. |
| PUT | `/admin/content/:id` | Update content. |
| DELETE | `/admin/content/:id` | Hard-delete content. |

### Member-Compatible Streamer Routes

All current streamer routes are guarded by authentication and `streamer` role middleware. Target naming treats these as member-compatible routes until `/member/*` surfaces are implemented.

| Method | Route | Current behavior |
| --- | --- | --- |
| GET | `/streamer/browse` | Browse available content. |
| GET | `/streamer/search` | Reuse browse controller. |
| GET | `/streamer/content/:id` | Render details. |
| POST | `/streamer/content/:id/shortlist` | Add embedded User shortlist item. |
| POST | `/streamer/content/:id/shortlist/remove` | Remove embedded User shortlist item. |
| GET | `/streamer/shortlist` | Render shortlist. |
| POST | `/streamer/content/:id/rent` | Create rental directly. |
| GET | `/streamer/rentals` | Render rentals. |
| POST | `/streamer/rentals/:id/checkout` | Mark rental completed. |

No state-changing GET route was found in route declarations.

### Target Route Families

| Surface | Target examples | Current implementation status |
| --- | --- | --- |
| Public | `/`, `/browse`, `/titles/:slug` | Partially implemented through home, streamer browse, and `/content/:id` compatibility. |
| Member | `/member/home`, `/member/my-list`, `/member/access`, `/member/account` | Backed by `/streamer/*` compatibility routes. |
| Partner | `/partner/programs`, `/partner/titles`, `/partner/release-windows` | Not implemented. |
| Administrator | `/admin`, `/admin/catalog`, `/admin/programs`, `/admin/partners`, `/admin/access`, `/admin/audit` | Partially implemented through `/admin/dashboard` and `/admin/content`. |

## Model Inventory

### User

Current ownership:

- `email`
- `password`
- `role`: `admin` or `streamer`
- embedded `shortlist`
- duplicated `rented`
- `watchHistory`

Confirmed issues:

- `shortlist` grows inside the user document.
- `rented` duplicates `Rental` records.
- `watchHistory` implies playback that the product does not implement.
- Account status, session version, password-changed timestamp, and deletion state are absent.
- Password field is named `password` even though it stores a hash.

### Content

Current ownership:

- title, type, description, price, image, available, rating, genre, duration, cast, trending, rentalLimit.

Confirmed issues:

- `available` combines publication visibility and licence availability.
- `price` is a floating number.
- `type` uses `movie` and `tv`; target vocabulary is `movie` and `series`.
- lifecycle, slug, archival timestamps, active licence count, and price currency are absent.
- normal admin management can hard-delete content.

### Rental

Current ownership:

- `userId`
- `contentId`
- `status`: `active` or `completed`
- `date`
- `rentedAt`
- `expiresAt`
- `completedAt`

Confirmed issues:

- `date` and `rentedAt` overlap.
- `completed` does not distinguish returned, expired, or cancelled.
- rental snapshots, idempotency key, public reference, and end reason are absent.
- exact-once release path is absent.

## Confirmed P0 Findings

| Finding | Status | Evidence |
| --- | --- | --- |
| Product terminology mixes streaming, rental, checkout, streamer, shortlist, and watch-history concepts. | Confirmed | README and views still use those terms. |
| Public signup creates `streamer`, not target `member`. | Confirmed | `authController.signup` writes `role: 'streamer'`. |
| `app.js` owns too many responsibilities. | Confirmed | Composition and startup are combined in `app.js`. |
| User embeds shortlist and rented arrays. | Confirmed | `models/User.js`. |
| Rental records also exist independently. | Confirmed | `models/Rental.js`. |
| Watch history exists without playback. | Confirmed | `models/User.js`. |
| Price uses floating `Number`. | Confirmed | `models/Content.js`. |
| Catalog visibility uses one `available` boolean. | Confirmed | `models/Content.js`. |
| Admin routes hard-delete titles. | Confirmed | `contentService.deleteContent` uses `findByIdAndDelete`. |
| Rental capacity uses count-before-create. | Confirmed | `rentalService.createRental`. |
| Rental confirmation has no idempotency. | Confirmed | No idempotency key or unique retry contract. |
| Expired rentals do not have a defined release worker. | Confirmed | Current rental status has no `expired` state or expiry job. |
| Capacity display counts active rentals once per title. | Confirmed | `attachCapacityToContents` maps title list to `countDocuments` calls. |
| Login and signup share one limiter. | Confirmed | `routes/auth.js` uses `loginRateLimiter` for both POST routes. |
| Interface lacks one documented state matrix. | Confirmed | Existing docs describe flows but not one full page-state matrix. |

## Rejected Or Not Confirmed

| Finding | Status | Notes |
| --- | --- | --- |
| State-changing GET routes exist. | Rejected for current route declarations | All current mutations are POST, PUT, or DELETE. |
| Handoff route inventory is complete. | Rejected | Live app also has `GET /content/:id` JSON route. |

## Unknowns

- Whether any real database has legacy records requiring migration.
- Whether existing `completed` rentals mean voluntary return, expiry, or a generic terminal state.
- Whether CAD or USD is intended as the final currency.
- Whether email delivery is in scope for password reset.
- Whether final hosting will happen before portfolio review.
- Whether target deployment topology supports MongoDB transactions.
- Whether account deletion should anonymize or erase historical identity.
