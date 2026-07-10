# S5 Stage Completion Report: Atomic Rental Lifecycle

## Objective

Make rental creation, return, expiry, and capacity accounting consistent under duplicate submissions and last-seat races while keeping current member routes compatible.

## Repository State

- Branch: `fix/streamnexus-rental-consistency`
- Base: `dev` after S4 data contracts
- Integration target: `dev`

## Facts

- Rental creation now reserves a title licence through an atomic conditional `Content.findOneAndUpdate`.
- Duplicate active rentals for the same user/title are treated idempotently.
- A partial unique index prevents duplicate active target rentals by `userId`, `titleId`, and `status`.
- Return, expiry, and admin cancellation paths release licence count through a guarded decrement.
- Capacity list reads use an aggregate instead of one count query per title.

## Assumptions

- MongoDB single-document atomicity is sufficient for this prototype stage.
- Full multi-document transactions remain out of scope because the sandbox uses memory Mongo.
- Current `streamer` route names remain compatible until the S7 member IA cutover.

## Files Changed

- `models/Rental.js`
- `src/modules/rentals/rentals.repository.js`
- `src/modules/rentals/rentals.service.js`
- `controllers/streamerController.js`
- `test/rental-lifecycle.test.js`

## Behavior Changed

- Last-seat races allow one successful rental and one capacity error.
- Duplicate rental submissions return the existing active rental instead of creating a second rental.
- Member checkout now maps to returned rental state.
- Returned, expired, and cancelled rentals are grouped with completed history in the existing rentals view.

## Behavior Intentionally Unchanged

- Real payments are still not implemented.
- Existing member route URLs remain unchanged.
- Existing rental confirmation remains simulated.

## Tests Added Or Updated

- Added lifecycle tests for last-seat race, duplicate submission, double return, and return/expiry race.

## Commands And Observed Results

- `npm test` - passed; 21 tests passed, 0 failed
- `npm run test:ejs` - passed; 14 EJS templates compiled
- `npm run sandbox:smoke` - passed
- `npm audit --audit-level=moderate` - passed; 0 vulnerabilities
- `npm run scan:secrets` - passed; no secret-pattern matches found
- `npm run test:load` - passed; 200 requests, average 3 ms, p95 6 ms, max 9 ms
- `git diff --check` - passed

## Security Review

- No new dependencies were added.
- Rental ownership checks remain enforced before returns.
- Admin cancellation service requires an explicit actor id when called.

## Accessibility Review

- No UI markup changed in S5.

## Data Migration And Rollback

- Existing rentals remain readable.
- Rollback is branch-level: revert this PR to restore count-before-create rental behavior.

## Unknowns

- Production MongoDB transaction semantics are not exercised in S5.
- Scheduled expiry is represented as a service method, not an external job runner.

## Risks

- Legacy `rentalLimit` remains the effective capacity field until full target cutover.
- Existing title documents should run S4/S5 reconciliation before any public demo using persistent data.

## Recommended Next Stage

Proceed to S6: authentication and session hardening.
