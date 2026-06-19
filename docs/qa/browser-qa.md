# Browser QA Evidence

Status: Pass.

Run date: 2026-06-17.

Target: `http://127.0.0.1:3123` using an in-memory MongoDB instance.

Expected flows:

- Guest landing renders with signup and sign-in entry points.
- Streamer signup reaches the browse carousel.
- Streamer opens a content modal from a card.
- Streamer rents from the modal and sees the 45-day rental expiry.
- Mobile browse renders without horizontal overflow.
- Admin signs in, sees rental capacity, and creates catalog content.
- Desktop and mobile widths render without visible broken poster images.
- Console warnings/errors: none captured.
- Failed network requests: none captured.

Screenshots are evidence artifacts only; final portfolio screenshots and videos remain README placeholders for manual capture.

Evidence:

- `docs/qa/browser-qa-results.json`
- `docs/qa/screenshots/home-desktop.png`
- `docs/qa/screenshots/admin-dashboard-desktop.png`
- `docs/qa/screenshots/streamer-browse-desktop.png`
- `docs/qa/screenshots/streamer-content-modal-desktop.png`
- `docs/qa/screenshots/streamer-rentals-desktop.png`
- `docs/qa/screenshots/streamer-browse-mobile.png`
