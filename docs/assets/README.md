# StreamNexus Media Assets

This folder is reserved for public portfolio media. Do not add fake screenshots, fake thumbnails, generated demo claims, private notes, or files that reveal credentials.

## Asset Naming Rules

- Use the exact README paths for portfolio media:
  - `docs/assets/screenshots/01-home-desktop.png`
  - `docs/assets/screenshots/02-library-or-dashboard-desktop.png`
  - `docs/assets/screenshots/03-search-filter-desktop.png`
  - `docs/assets/screenshots/04-detail-page-desktop.png`
  - `docs/assets/screenshots/05-empty-state-desktop.png`
  - `docs/assets/screenshots/06-mobile-home.png`
  - `docs/assets/screenshots/07-mobile-core-flow.png`
  - `docs/assets/videos/streamnexus-demo-thumbnail.png`
  - `docs/assets/videos/streamnexus-demo.mp4`
- Keep filenames lowercase, numbered, and descriptive.
- Prefer PNG for screenshots and MP4 for the final walkthrough.

## Screenshot Capture Rules

- Capture only real app screens from a verified local or demo runtime.
- Use demo accounts and seeded demo data only.
- Capture desktop and mobile widths listed in the README screenshot map.
- Check for broken images, visible errors, console failures, and private data before adding files.
- Do not edit screenshots to imply features that are not implemented.

## Video Capture Rules

- Record a real walkthrough of implemented flows only.
- Keep the video focused on login, browse/search, details, shortlist/rental, simulated checkout, and admin catalog management.
- Do not include browser bookmarks, local filesystem paths, terminal secrets, private notes, or external account dashboards.
- Create the thumbnail from the real recording or a real captured screen.

## Privacy Redaction Rules

- Redact or recapture anything that shows credentials, MongoDB URIs, session secrets, private emails, private paths, raw logs, or internal strategy notes.
- Follow the repository security guidance and use public-safe demo data.
- When in doubt, recapture with safe demo data.

## No Fake Media Rule

Placeholders may exist as missing future paths, but fake screenshots and fake videos must not be committed. A media file should only be added when it is captured from the actual StreamNexus app state it claims to show.
