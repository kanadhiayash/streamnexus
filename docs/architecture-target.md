# StreamNexus Target Architecture

**Stage:** S0 product contract and traceability
**Status:** Directional target, not a one-step rewrite

## Architecture Style

Use a server-rendered modular monolith:

```text
Browser
-> Express route
-> input validation
-> controller
-> use case
-> repository
-> Mongoose model
-> MongoDB
-> domain result
-> controller mapping
-> EJS, redirect, or JSON
```

Browser JavaScript is progressive enhancement only. It may improve dialogs, pending states, focus behavior, and display preferences, but it must not own authorization, pricing, licence availability, or rental state transitions.

## Current Boundary

The current app is a compact MVC/service structure:

```text
app.js
-> routes/
-> controllers/
-> services/
-> models/
-> views/
```

This structure is readable and should be migrated incrementally. S0 does not move runtime files.

## Target Runtime Profiles

### Sandbox

- `APP_RUNTIME=sandbox`
- ephemeral MongoDB
- in-memory session store
- deterministic fictional seed
- generated local-only session secret
- loopback binding
- no `.env` required
- no external services
- clean shutdown
- safe health endpoint

### Test

- ephemeral MongoDB
- in-memory sessions
- controlled clock
- controlled ID generator where needed
- captured logger
- no external services

### Production-Capable

- validated environment
- real MongoDB
- `connect-mongo`
- seed disabled
- secrets from environment only
- secure cookies behind a trusted HTTPS proxy
- structured logs
- explicit shutdown

## Target Module Direction

```text
src/
  app/
  config/
  modules/
    auth/
    catalog/
    saved-titles/
    access/
    programs/
    partners/
    release-windows/
    members/
    admin/
    audit/
  infrastructure/
  shared/
  demo/
  views/
  public/
```

The exact layout may be adjusted during S2 and S3, but the boundaries are fixed:

- routes own URLs, HTTP methods, middleware order, validation middleware, and controller selection
- controllers own request DTO extraction, calling one use case, known-error mapping, rendering, and redirects
- use cases own business decisions, role/ownership authorization, state transitions, idempotency, transaction boundaries, multi-repository coordination, domain errors, and audit intent
- repositories own Mongoose queries, selected projections, persistence mapping, transaction session support, and cursor pagination
- views own semantic HTML, role-specific actions, form values, errors, and state rendering
- browser scripts own only progressive enhancement

## Target Product Domains

The SNX-102 contract defines StreamNexus as a curated screening and access platform. Target modules must use these product boundaries:

| Module | Boundary |
| --- | --- |
| `catalog` | Title metadata, lifecycle, public visibility, and compatibility mapping from `Content`. |
| `programs` | Curated initiatives that group titles under a partner, theme, or screening purpose. |
| `partners` | Partner identity, ownership boundaries, and future partner-facing read models. |
| `release-windows` | Scheduled, active, ended, cancelled, and archived availability windows. |
| `access` | Access policies, seat limits, entitlement confirmation, active access, expiry, cancellation, and return access. |
| `saved-titles` | Member-owned My List state. |
| `admin` | Operational dashboards and workflows across catalog, partners, programs, access, members, and audit. |

Legacy `rentals` naming is compatibility only. New implementation work should introduce access-domain names unless a file is intentionally bridging old routes or persisted models.

## Configuration Rules

Configuration must be validated once at startup and grouped by:

- runtime
- server
- database
- session
- security
- rental policy
- pagination
- rate limits
- logging
- demo

Controllers and services should not read `process.env` directly after S2.

## Error Model

Target typed errors:

- ValidationError
- AuthenticationRequiredError
- AuthenticationFailedError
- ForbiddenError
- NotFoundError
- ConflictError
- RateLimitError
- CapacityConflictError
- DuplicateRentalError
- AccountInactiveError
- DataIntegrityError

Public responses contain a safe title, safe explanation, recovery action, and request reference. Logs may contain error class, safe message, request ID, actor ID when safe, target ID when safe, and stack only in controlled server logs.

## Dependency Policy

New dependencies require a defined problem, owner module, security review, licence review, test, and removal plan if experimental.

Likely justified in later stages:

- Playwright for browser and capture automation
- accessibility test integration

Not approved:

- front-end framework
- DI framework
- generic base repository
- microservices
- GraphQL
- TypeScript migration as part of this upgrade

## CI Integration Note

Current CI runs on pushes to `main` and `chore/**`, and on pull requests to `main`. The staged plan uses branches such as `docs/**`, `refactor/**`, `fix/**`, `security/**`, `feat/**`, and `test/**`.

Before relying on GitHub CI for PRs targeting `dev`, either update CI in a dedicated approved stage or manually run local gates for every stage. S0 records this as a release-process gap.
