# StreamNexus Threat Model

**Stage:** S0 product contract and traceability
**Status:** Proposed baseline threat model

## Security Objective

Protect account credentials, sessions, role boundaries, member-owned data, administrator actions, rental capacity, rental integrity, private configuration, logs, and public repository trust.

StreamNexus is a portfolio prototype, but its security controls must be real and testable.

## Assets

- password hashes
- sessions
- account roles and future account status
- saved titles
- rental records
- licence counts
- administrator actions
- MongoDB configuration
- future reset tokens
- logs and audit events
- README and portfolio evidence

## Trust Boundaries

- browser to Express
- Express to session store
- route/controller to use case
- use case to repository
- repository to MongoDB
- sandbox fixtures to runtime
- member to own data
- administrator to privileged actions
- CI to repository secrets
- local evidence to public claims

## Primary Threats

- credential stuffing
- account enumeration
- session fixation
- missing session invalidation
- CSRF
- horizontal privilege escalation
- vertical privilege escalation
- duplicate rental creation
- licence oversubscription
- NoSQL injection
- stored or reflected XSS through catalog fields
- unbounded resource consumption
- destructive admin action
- sensitive data in logs
- secret commits
- insecure demo configuration
- open redirects
- raw error disclosure
- fake public evidence claims

## Current Positive Controls

- Helmet is configured.
- CSRF middleware protects unsafe browser requests.
- Session cookie is `httpOnly`, `sameSite: lax`, and `secure` in production.
- Login rate limiting exists.
- Role middleware guards admin and streamer routes.
- Passwords use `bcryptjs`.
- ObjectId-shaped parameters are checked in services.
- Search input is sanitized before regex search.
- `.env` is ignored.
- Secret pattern scan passed in S0.

## Current Gaps

- Development session secret has a known fallback.
- Login and signup share one limiter.
- No explicit session regeneration is visible after login/signup.
- CSRF rotation after auth transition is not documented.
- Password change, reset-token, account status, and session revocation flows are absent.
- Action-specific mutation limiters are absent.
- Request body limits use framework defaults.
- Audit events are absent.
- Normal admin deletion is destructive.
- Logs include routine emails and stack traces in test output.
- Sandbox runtime is not an explicit isolated composition.
- Public registration maps to `streamer`.
- Rental confirmation is not idempotent.
- Rental capacity is count-before-create and not concurrency-safe.
- Dependency audit currently fails on `undici` through the direct `npm` package dependency.

## Authorization Matrix

| Action | Guest | Member | Admin |
| --- | ---: | ---: | ---: |
| Browse published title | Yes | Yes | Yes |
| View draft title | No | No | Yes |
| Save title | No | Own account | No normal need |
| Confirm rental | No | Own active account | No normal need |
| Return rental | No | Own rental | Defined admin cancellation only |
| Edit title | No | No | Yes |
| Publish title | No | No | Yes |
| Archive title | No | No | Yes |
| View member detail | No | Own account only | Minimized admin view |
| Change role | No | No | Controlled bootstrap only |
| Suspend member | No | No | Yes, with reason |
| View audit | No | No | Yes |

Route middleware is not sufficient. Use cases must enforce role and ownership.

## Required Security Tests

- missing, invalid, and stale CSRF
- session fixation
- session invalidation
- horizontal access control
- vertical access control
- account enumeration
- brute-force limiter
- NoSQL operator injection
- stored and reflected XSS payloads
- oversized request bodies
- parameter pollution
- invalid IDs
- duplicate rental
- capacity race
- double return
- expiry and return race
- open redirect
- safe error response
- secret scan
- dependency audit

## Approval-Gated Actions

The following require explicit human approval:

- use real credentials
- connect to shared or Atlas database
- run destructive migrations
- change history
- push branches
- create GitHub issues or PRs
- merge PRs
- deploy
- publish screenshots, GIFs, or video
