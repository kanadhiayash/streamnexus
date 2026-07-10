# S8 Stage Completion Report

Date: 2026-07-10
Branch: `feat/streamnexus-rental-experience`
Integration target: `dev`

## Scope

- Added a rental review page before confirmation.
- Added simulated-payment disclosure and kept payment/playback out of scope.
- Redirected confirmed rentals with a public reference.
- Added owner-scoped rental detail by public reference.
- Split rentals into Active Access and History views.
- Kept return access as a CSRF-protected POST action.
- Removed member-facing checkout/completed language from the rental journey.

## Acceptance Evidence

- Member completes full rental journey: covered by `member reviews, confirms, opens, and returns a rental by public reference`.
- Refresh/duplicate submit does not create a second active rental: covered by active rental count assertion.
- Expiry and return state are visible in Active Access, History, and rental detail views.
- Ownership protection: second member receives 403 for another member's public rental reference.
- Mutation states remain POST plus CSRF for confirmation and return access.

## Verification

- `npm test` passed: 27 tests.
- `npm run test:ejs` passed: 16 EJS templates compiled.
- `npm run sandbox:smoke` passed.
- `npm audit --audit-level=moderate` passed: 0 vulnerabilities.
- `npm run scan:secrets` passed: no tracked secret-pattern matches found.
- `npm run test:load` passed: 200 requests, average 2 ms, p95 3 ms.
- `git diff --check` passed.

## Risks

- The route name for returning access remains `/checkout` internally for compatibility, while user-facing copy now says Return Access.
- Public-reference detail pages intentionally render generic error text through the shared error handler for unauthorized access.
