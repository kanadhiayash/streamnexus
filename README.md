# StreamNexus

StreamNexus is a full-stack streaming rental prototype with role-based admin and streamer workflows, MongoDB persistence, and a simulated checkout flow.

> Portfolio status: local/demo-ready documentation. This README does not claim hosted production deployment, real users, payment processing, compliance, final screenshots, or a recorded demo video.

## Product Preview

The final portfolio screenshots are not included yet. Yash should replace these placeholders only after capturing real screens from a verified local or demo runtime.

![StreamNexus home desktop placeholder](docs/assets/screenshots/01-home-desktop.png)

## Demo Walkthrough

The final demo video is not included yet. The thumbnail and MP4 paths below are reserved for a real recording that Yash will add manually.

[![StreamNexus demo video thumbnail placeholder](docs/assets/videos/streamnexus-demo-thumbnail.png)](docs/assets/videos/streamnexus-demo.mp4)

Planned demo path: `docs/assets/videos/streamnexus-demo.mp4`

## What the App Does

StreamNexus models the core workflows of a streaming rental product:

- Admins manage catalog content and review rental activity.
- Streamers can create a streamer account, browse titles, search and filter content, open floating detail panels or details pages, build a shortlist, rent available content, and complete a simulated rental return.
- Rental access lasts 45 days: 30 rental days plus 15 StreamNexus bonus days.
- MongoDB stores users, content, rentals, and session data.
- Server-rendered EJS views keep the interface simple to inspect, run, and test.

This is a portfolio prototype, not a production OTT platform. It does not include real payment processing, real media playback, subscription billing, a production identity provider, or compliance certification.

## Core Features

| Area | Implemented capability |
| --- | --- |
| Authentication | Session-based login/logout, streamer signup, and seeded local demo users |
| Authorization | Admin and streamer route guards |
| Admin tools | Dashboard, catalog list, create/edit/delete content, rental capacity, rental summary views |
| Streamer flows | Landing, signup, browse, hero carousel, search, filter, content modal, details, similar titles, shortlist, rentals, simulated completion |
| Persistence | Mongoose models for users, content, and rentals |
| Security basics | Password hashing, CSRF checks, login rate limiting, Helmet headers, validated ObjectIds |
| Assets | Local poster images for seeded demo titles with documented source notes |
| Testing | Syntax, integration, EJS compile, dependency audit, secret scan, and bounded load checks |
| CI | GitHub Actions workflow for install, tests, EJS compile, audit, and secret scan |

## Tech Stack

| Layer | Technology |
| --- | --- |
| Runtime | Node.js, CommonJS |
| Server | Express 5 |
| Views | EJS, `express-ejs-layouts` |
| Styling | Vanilla CSS |
| Browser behavior | Vanilla JavaScript |
| Database | MongoDB |
| ODM | Mongoose |
| Sessions | `express-session`, `connect-mongo` |
| Security middleware | `helmet`, `express-rate-limit`, custom CSRF middleware |
| Auth utilities | `bcryptjs` |
| Forms | `method-override`, server-rendered EJS forms |
| Environment config | `dotenv` |
| Testing | Node test runner, Supertest, `mongodb-memory-server`, local load script |

## Architecture Overview

StreamNexus uses a compact MVC/service structure:

```text
Browser
  -> Express routes
  -> Controllers
  -> Services
  -> Mongoose models
  -> MongoDB
  -> EJS response or JSON response
```

Primary boundaries:

- `app.js` configures Express, middleware, sessions, routes, startup, and demo seeding.
- `routes/` defines feature-level HTTP routes.
- `controllers/` handles request flow, validation handoff, redirects, and view rendering.
- `services/` owns database operations and business rules.
- `models/` defines Mongoose schemas.
- `middleware/` contains auth, role checks, CSRF handling, rate limiting, and errors.
- `views/` renders admin and streamer screens.
- `test/` verifies high-risk flows with Supertest and an in-memory MongoDB server.

Supporting docs:

- [Architecture](docs/architecture.md)
- [User flows](docs/user-flows.md)
- [Setup notes](docs/setup-notes.md)
- [Future roadmap](docs/future-roadmap.md)
- [Poster image sources](docs/assets/IMAGE_SOURCES.md)

## Local Setup

Prerequisites:

- Node.js 20 or newer
- npm
- Local MongoDB or a MongoDB Atlas connection string

Install dependencies:

```bash
npm install
```

Create a local environment file from the safe template:

```bash
cp .env.example .env
```

Update `.env` locally. Do not commit `.env`.

Start the app in watch mode:

```bash
npm run dev
```

Start without watch mode:

```bash
npm start
```

Open the local app:

```text
http://localhost:3000
```

## Environment Variables

Use [.env.example](.env.example) as the source of safe placeholder values. The real `.env` file is local-only and must stay out of git.

Key values:

| Variable | Purpose |
| --- | --- |
| `PORT` | Local HTTP port |
| `NODE_ENV` | Runtime mode |
| `MONGO_URI` | Local MongoDB or Atlas database URI |
| `SESSION_SECRET` | Session signing secret, required for production mode |
| `SEED_DEMO_DATA` | Enables local demo records when set to `true` |
| `DEMO_ADMIN_EMAIL` / `DEMO_ADMIN_PASSWORD` | Optional local admin demo credentials |
| `DEMO_STREAMER_EMAIL` / `DEMO_STREAMER_PASSWORD` | Optional local streamer demo credentials |
| `LOGIN_RATE_LIMIT_WINDOW_MS` / `LOGIN_RATE_LIMIT_MAX` | Login rate-limit tuning |
| `LOAD_TEST_ITERATIONS` / `LOAD_TEST_MAX_AVG_MS` / `LOAD_TEST_MAX_P95_MS` | Local load-test thresholds |

Default local seeded accounts exist in code when demo overrides are not provided:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@gmail.com` | `admin` |
| Streamer | `streamer@gmail.com` | `streamer` |

These credentials are for local development only. Override them before any shared demo.

## Quality Gates

Run the main documentation and release-readiness checks:

```bash
git status --short
npm test
npm run test:ejs
npm audit --audit-level=moderate
npm run scan:secrets
npm run test:load
```

What these gates cover:

- JavaScript syntax checks
- Integration tests for auth, roles, CSRF, admin content creation, streamer shortlist/rental flows, search handling, and login rate limiting
- EJS template compilation
- Dependency audit at moderate severity or higher
- Tracked secret-pattern scan
- Bounded local load smoke check

QA evidence lives in [docs/qa](docs/qa/). Existing QA screenshots under `docs/qa/screenshots/` are evidence artifacts, not final README media.

## Security and Privacy Notes

- `.env` and `.env.*` are ignored; `.env.example` is the tracked safe template.
- Local workspace metadata, logs, dumps, generated runtime data, and platform state should remain untracked.
- Do not commit MongoDB credentials, session secrets, service account files, private notes, or raw logs.
- Checkout is simulated and does not process real payments.
- The load test is a local regression smoke check, not a production capacity claim.
- Public docs must avoid private career strategy, internal paths, fake media, fake metrics, and unverifiable claims.

See also:

- [Security review](docs/security/security-review.md)

## Screenshot Map

The README expects these future portfolio media files. Keep the filenames stable so links continue to work after Yash adds real captures.

| Slot | Future path | Capture intent |
| --- | --- | --- |
| 01 | `docs/assets/screenshots/01-home-desktop.png` | Desktop landing page |
| 02 | `docs/assets/screenshots/02-library-or-dashboard-desktop.png` | Main streamer library or admin dashboard with capacity |
| 03 | `docs/assets/screenshots/03-search-filter-desktop.png` | Search and filter behavior |
| 04 | `docs/assets/screenshots/04-detail-page-desktop.png` | Content modal or detail page |
| 05 | `docs/assets/screenshots/05-empty-state-desktop.png` | Empty or no-results state |
| 06 | `docs/assets/screenshots/06-mobile-home.png` | Mobile entry or home state |
| 07 | `docs/assets/screenshots/07-mobile-core-flow.png` | Mobile core streamer flow |
| Video thumbnail | `docs/assets/videos/streamnexus-demo-thumbnail.png` | Real thumbnail from the demo recording |
| Demo video | `docs/assets/videos/streamnexus-demo.mp4` | Real walkthrough recording |

Current placeholder references:

![Home desktop placeholder](docs/assets/screenshots/01-home-desktop.png)
![Library or dashboard desktop placeholder](docs/assets/screenshots/02-library-or-dashboard-desktop.png)
![Search filter desktop placeholder](docs/assets/screenshots/03-search-filter-desktop.png)
![Detail page desktop placeholder](docs/assets/screenshots/04-detail-page-desktop.png)
![Empty state desktop placeholder](docs/assets/screenshots/05-empty-state-desktop.png)
![Mobile home placeholder](docs/assets/screenshots/06-mobile-home.png)
![Mobile core flow placeholder](docs/assets/screenshots/07-mobile-core-flow.png)

## Roadmap

| Priority | Item | Status |
| --- | --- | --- |
| High | Add real portfolio screenshots and demo video | Planned |
| High | Verify real local runtime after Yash recreates `.env` | Planned |
| High | Add a deployment guide after a provider is selected and verified | Planned |
| Medium | Add password reset and stronger non-demo account policy | Planned |
| Medium | Add watch-history UI for the existing model field | Planned |
| Medium | Add pagination for larger catalog and rental lists | Planned |
| Medium | Add richer filtering by genre, rating, price, and availability | Planned |
| Low | Add poster upload or asset management flow | Planned |

## Author

Yash Kanadhia

## License

This repository includes an MIT License file: [LICENSE](LICENSE).
