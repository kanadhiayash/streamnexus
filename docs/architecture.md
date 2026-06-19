# StreamNexus Architecture

StreamNexus is a server-rendered full-stack web application built with Node.js, Express, EJS, and MongoDB. It follows a compact MVC-style structure with routes, controllers, services, models, middleware, views, and public assets separated by responsibility.

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
| Authentication | `routes/auth.js`, `controllers/authController.js` | Login, logout, streamer signup, demo data seeding |
| Admin workflows | `routes/admin.js`, `controllers/adminController.js` | Dashboard and catalog CRUD |
| Streamer workflows | `routes/streamer.js`, `controllers/streamerController.js` | Browse, details, shortlist, rentals, checkout |
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

The test suite uses Node's built-in test runner, Supertest, and `mongodb-memory-server` to verify landing routing, signup, authentication, role guards, CSRF behavior, admin content creation, streamer shortlist/rental flows, rental capacity, expiry windows, regex-safe search, and login rate limiting.
