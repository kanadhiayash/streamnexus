# StreamNexus Demo Capture Plan

Date prepared: 2026-07-10
Status: plan only. No final screenshots or video were captured in this stage.

## Review Gate

Yash should review `dev` before capture. Do not merge to `main`, replace README placeholders, or publish final media until that review is complete.

## Preflight

Run these commands from the repo root:

```bash
npm install
npm run release:verify
npm run sandbox
```

Open the local sandbox URL printed by the app. Use a clean browser profile or private window so previous sessions do not affect the walkthrough.

## Demo Accounts

Use local demo credentials only:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@gmail.com` | `admin` |
| Member | `streamer@gmail.com` | `streamer` |

Do not show `.env`, terminal secrets, browser password managers, private tabs, or local filesystem paths in the recording.

## Screenshot Capture List

Save final portfolio screenshots to these exact paths:

| Slot | Path | Capture intent |
| --- | --- | --- |
| 01 | `docs/assets/screenshots/01-home-desktop.png` | Desktop landing page with product name visible |
| 02 | `docs/assets/screenshots/02-library-or-dashboard-desktop.png` | Admin dashboard or member catalog showing capacity/status |
| 03 | `docs/assets/screenshots/03-search-filter-desktop.png` | Search/filter result state |
| 04 | `docs/assets/screenshots/04-detail-page-desktop.png` | Title detail or rental review page |
| 05 | `docs/assets/screenshots/05-empty-state-desktop.png` | No-results or empty state |
| 06 | `docs/assets/screenshots/06-mobile-home.png` | Mobile landing or catalog entry |
| 07 | `docs/assets/screenshots/07-mobile-core-flow.png` | Mobile rental review/confirmation flow |

Recommended desktop viewport: 1440 x 1000.
Recommended mobile viewport: 390 x 844.

## Video Walkthrough

Save the real recording to:

```text
docs/assets/videos/streamnexus-demo.mp4
```

Save a real thumbnail frame to:

```text
docs/assets/videos/streamnexus-demo-thumbnail.png
```

Suggested sequence:

1. Landing page and product framing.
2. Member signup or member login.
3. Browse catalog, search, and filter.
4. Open a title detail surface.
5. Review rental disclosure and confirm rental.
6. Show Active Access with public reference.
7. Return access and show History.
8. Admin dashboard capacity view.
9. Admin archive/restore/publish lifecycle controls.

Keep the video under 3 minutes for portfolio review.

## Acceptance Check Before Publishing Media

- `npm run release:verify` passes after media files are added.
- Screenshots show real app screens, not placeholders.
- Video does not show secrets, private local paths, browser autofill, or unrelated tabs.
- README placeholder wording is updated only after real media files exist.
- `git status --short` shows only intentional media/docs changes before staging.
