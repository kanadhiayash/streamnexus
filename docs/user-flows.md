# StreamNexus User Flows

This document describes the implemented product flows in the current codebase.

## Admin Flow

1. Admin opens `/login`.
2. Admin submits valid credentials.
3. The app stores the authenticated user in the session.
4. Admin is redirected to `/admin/dashboard`.
5. Admin can view content and rental summaries.
6. Admin can create new content at `/admin/content/new`.
7. Admin can edit existing content from the dashboard or content list.
8. Admin can delete content through protected form actions.
9. Admin can log out through the shared header.

## Streamer Flow

1. Guest opens `/`.
2. Guest can sign in at `/login` or create a streamer-only account at `/signup`.
3. Streamer submits valid credentials or completes signup.
3. The app stores the authenticated user in the session.
4. Streamer is redirected to `/streamer/browse`.
5. Streamer can browse available movie and TV content through a hero carousel and catalog grid.
6. Streamer can filter by content type and search by title, description, or genre.
7. Streamer can open a floating content detail panel from any browse card.
8. Streamer can add or remove a title from the shortlist.
9. Streamer can rent available content when capacity is open.
10. Streamer can view active and completed rentals with the rental expiry date.
11. Streamer can complete the simulated rental return flow.
12. Streamer can log out through the shared header.

## Access Control Behavior

- Guests are redirected to `/login` when accessing protected pages.
- Authenticated users are redirected away from `/login`.
- Signup always creates the `streamer` role and ignores client-supplied role values.
- Admin-only pages return a forbidden response to streamer users.
- Streamer-only pages return a forbidden response to admin users.
- Mutating form submissions require a valid CSRF token.
