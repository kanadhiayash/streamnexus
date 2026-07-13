# StreamNexus Architecture

StreamNexus is a server-rendered full-stack web application built with Node.js, Express, EJS, and MongoDB. It follows a compact MVC-style structure with routes, controllers, services, models, middleware, views, and public assets separated by responsibility.

## SNX Pivot Contract

The target product contract is a curated screening and access platform, not a rental-first business identity. The current architecture still contains compatibility names such as streamer, content, rental, shortlist, checkout, and rental limit. Those names map to member, title, access entitlement, My List, return access, and access-policy seat limit until issue-backed migrations replace them.

Runtime behavior must preserve compatibility while future work introduces the target public, member, partner, and administrator surfaces. Partner, program, collection, release-window, access-policy, and entitlement behavior are documented target domains, not current runtime claims.

## Runtime Flow

1. `app.js` loads environment variables, configures Express middleware, sets up sessions, enables EJS layouts, serves static assets, mounts feature routes, and starts the server.
2. `config/db.js` connects Mongoose to the configured MongoDB instance.
3. Route files in `routes/` group HTTP endpoints by feature area.
4. Controller files in `controllers/` handle request and response behavior.
5. Service files in `services/` contain database and workflow logic.
6. Mongoose models in `models/` define persisted data structures.
7. EJS templates in `views/` render the admin and streamer interfaces.

## Core Modules

| Area | Files | Responsibility |
| --- | --- | --- |
| Application bootstrap | `app.js` | Express setup, middleware, routing, startup |
| Database | `config/db.js` | MongoDB connection through Mongoose |
| Authentication | `routes/auth.js`, `controllers/authController.js` | Login, logout, member-compatible signup, demo data seeding |
| Admin workflows | `routes/admin.js`, `controllers/adminController.js` | Dashboard and catalog CRUD |
| Member-compatible workflows | `routes/streamer.js`, `controllers/streamerController.js` | Browse, details, My List compatibility, access-entitlement compatibility, return-access compatibility |
| Content API | `routes/content.js`, `controllers/contentController.js` | JSON lookup for content records |
| Business logic | `services/*.js` | Content, rental, and user operations |
| Security middleware | `middleware/*.js` | Auth guards, role guards, CSRF, rate limiting, error handling |
| Persistence models | `models/*.js` | User, content, and rental schemas |
| UI | `views/`, `public/` | EJS views, CSS, browser JavaScript |
| Tests | `test/app.test.js` | Syntax and integration checks |

## Data Model

### User

Stores email, hashed password, role, shortlist references, rented content references, and a watch-history structure reserved for future product work.

### Content

Stores catalog metadata such as title, type, description, price, image path, availability, rating, genre, duration, cast, trending status, and active rental limit.

### Rental

Stores the relationship between a user and a content item, including rental status, rented-at time, expiry time, completion time, and timestamps.

Target mapping: `Rental` becomes the compatibility backing model for access entitlements until the access domain is implemented. New code should describe this concept as access entitlement unless it is touching legacy route, model, or database names.

### Target Access Domains

| Domain | Ownership boundary | Current runtime status |
| --- | --- | --- |
| Title | Fictional catalog metadata and lifecycle. | Backed by `Content`. |
| Program | Partner or editorial grouping for screening initiatives. | Not implemented. |
| Collection | Discovery grouping for public and member surfaces. | Partially approximated by existing rails and filters. |
| Partner | Organization or owner for programs and title sets. | Not implemented. |
| Release Window | Time-bounded availability for title, program, or collection access. | Not implemented. |
| Access Policy | Seat limits, eligibility, expiry, and return rules. | Partially approximated by `rentalLimit`. |
| Access Entitlement | Member-specific right to access an eligible title for a limited time. | Backed by `Rental`. |

## Security Controls

- Session-based authentication with `express-session`.
- MongoDB-backed session storage outside of test runs with `connect-mongo`.
- Role authorization for admin and streamer routes.
- CSRF token validation for unsafe form requests.
- Login rate limiting for repeated failed attempts.
- Password hashing through `bcryptjs`.
- Security headers through `helmet`.
- Search input escaping before MongoDB regex queries.

## Testing Strategy

The test suite uses Node's built-in test runner, Supertest, and `mongodb-memory-server` to verify landing routing, signup, authentication, role guards, CSRF behavior, admin content creation, member-compatible My List/access flows, capacity, expiry windows, regex-safe search, and login rate limiting.

SNX-102 adds document-level contract tests for the access-platform vocabulary and public-safe claim boundaries. Runtime tests for partner, program, release-window, access-policy, and entitlement behavior belong to their implementation issues.
