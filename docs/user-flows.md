# StreamNexus User Flows

This document describes the implemented product flows in the current codebase and the SNX-102 target route contract. Current runtime behavior still uses compatibility names while the product contract moves to curated screening and access-platform language.

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

## Member-Compatible Flow

1. Guest opens `/`.
2. Guest can sign in at `/login` or create a member-compatible account at `/signup`.
3. Member or legacy streamer submits valid credentials or completes signup.
3. The app stores the authenticated user in the session.
4. Member-compatible users are redirected to `/streamer/browse`.
5. Member-compatible users can browse available movie and TV title records through a hero carousel and catalog grid.
6. Member-compatible users can filter by content type and search by title, description, or genre.
7. Member-compatible users can open a floating title detail panel from any browse card.
8. Member-compatible users can add or remove a title from My List through the current shortlist compatibility path.
9. Member-compatible users can request access through the current rental compatibility path when capacity is open.
10. Member-compatible users can view active and completed access records with the expiry date.
11. Member-compatible users can return access through the current checkout compatibility flow.
12. Member-compatible users can log out through the shared header.

## Target SNX Route Contract

| Role | Target pages | Current compatibility |
| --- | --- | --- |
| Guest | Home, public browse, title detail, login, signup | Home, login, signup, `/content/:id` JSON. |
| Member | Member home, My List, access review, active access, access history, account security | `/streamer/browse`, `/streamer/shortlist`, `/streamer/rentals`. |
| Partner | Program list, partner titles, release windows | Not implemented. |
| Administrator | Overview, catalog, programs, partners, access operations, members, audit | `/admin/dashboard`, `/admin/content`. |

Issue #31 is superseded for future route naming. Its guest/member/admin home-state behavior remains valid compatibility behavior until the target route families are implemented.

## Access Control Behavior

- Guests are redirected to `/login` when accessing protected pages.
- Authenticated users are redirected away from `/login`.
- Signup creates a member-compatible role and ignores client-supplied role values.
- Admin-only pages return a forbidden response to streamer users.
- Streamer-only pages return a forbidden response to admin users.
- Mutating form submissions require a valid CSRF token.
