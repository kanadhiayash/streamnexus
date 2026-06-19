# StreamNexus QA Evidence

This folder stores evidence for local/demo readiness checks. Evidence must describe what was actually run and must not imply hosted production status or real user traffic.

## Required Evidence

Each QA pass should record:

- Date of the run.
- Runtime target, such as local app URL, test mode, or in-memory MongoDB.
- Exact commands run.
- Pass/fail result for each command.
- Browser flows checked, including desktop and mobile widths when relevant.
- Console errors, failed network requests, broken images, and visible UI issues.
- Any sanitized failure summary and likely next fix.

## Command Gates

Use these gates before public README or release-readiness claims:

```bash
git status --short
npm test
npm run test:ejs
npm audit --audit-level=moderate
npm run scan:secrets
npm run test:load
```

## Browser QA

Browser QA should cover:

- Guest redirect to login.
- Admin login, dashboard, content create/edit/delete where safe.
- Streamer login, browse, search/filter, details, shortlist, rent, and simulated checkout.
- Desktop and mobile layouts.
- Console and network checks.

Screenshots in `docs/qa/screenshots/` are evidence artifacts. Final portfolio screenshots belong in `docs/assets/screenshots/` after Yash captures real media for the README.

## Runtime Notes

If real Atlas runtime is not verified, say so directly. Do not use in-memory test results as proof of hosted deployment, production capacity, real traffic, or business outcomes.
