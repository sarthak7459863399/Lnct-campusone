# LNCT CampusOne

A mobile-first, installable campus app with separate dashboards for students, faculty and admins. The website is static (GitHub Pages) and uses **Supabase** for sign-in, the database and access rules.

## Setup
Follow [`supabase/SETUP.md`](supabase/SETUP.md): run `schema.sql`, create the first accounts, run `seed.sql`, then put your Project URL and anon key in `config.js`.

## How sign-in works
- Everyone signs in with their email and password on `login.html` after choosing their role. Students go to `index.html`, faculty to `faculty.html`, admins to `admin.html`.
- Roles are stored in the `profiles` table. Accounts are created by an admin and start as **pending** until approved in the admin console.
- What each role can read or change is enforced by Supabase row-level security (see `supabase/schema.sql`), so changing the website code in a browser can't unlock other people's data.
- "Forgot password?" emails a reset link that opens `reset.html`.

## Files
- `supabase/schema.sql` — tables, security rules and database functions
- `supabase/seed.sql` — first accounts' roles plus sample timetable, notices, assignments and attendance
- `supabase/SETUP.md` — step-by-step setup
- `config.js` — your Supabase Project URL and anon key
- `auth.js` — Supabase client, sign-in/out and the per-page role guard
- `login.html`, `login.js` — role-based sign-in page
- `reset.html`, `reset.js` — set a new password from the reset email
- `index.html`, `student.js` — student dashboard (timetable, attendance, notices, assignments)
- `faculty.html`, `faculty.js` — faculty dashboard (attendance marking, assignments, notices)
- `admin.html`, `admin.js` — admin console (approvals, roles, notices, activity log)
- `timetable.js` — live timetable used by the student and faculty pages
- `app.js` — shared header, account menu, helpers, navigation, install prompt
- `icons.js` — shared SVG icons
- `styles.css` — responsive mobile-first design with dark mode
- `manifest.webmanifest` — Progressive Web App settings
- `sw.js` — service worker that caches the app's own files (never Supabase data)
- `icon-192.png`, `icon-512.png` — app icons

## Publish on GitHub Pages
1. Upload the contents of this folder to the **root** of your repository (not the ZIP itself).
2. Make sure `index.html` is at the repository root.
3. In **Settings → Pages**, select **Deploy from a branch**, branch `main` (or the branch that contains the files), folder `/ (root)`, and save.
4. Wait for deployment, then open the Pages URL over HTTPS.

## Install on Android
1. Open the published Pages URL in Chrome.
2. Open the Chrome `⋮` menu.
3. Tap **Install app** or **Add to Home screen**.
4. Confirm the prompt.

## Important
Not connected to LNCT's official systems. The seed script adds sample data; replace it with real courses and timetables before real use.
