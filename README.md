# LNCT CampusOne

A mobile-first, installable **prototype** for a college campus app with separate dashboards for students, faculty and admins.

## Demo sign-in
Opening the site takes you to `login.html`. Pick a role and use its demo account (the login page has a **Fill in** button):

| Role    | ID / username   | Password     | Lands on       |
|---------|-----------------|--------------|----------------|
| Student | `0103CS241001`  | `student123` | `index.html`   |
| Faculty | `FAC1024`       | `faculty123` | `faculty.html` |
| Admin   | `admin`         | `admin123`   | `admin.html`   |

Each page only opens for its own role; anyone else is sent to their own dashboard or back to the login page. Sign out from the avatar menu (top right) or the **Profile** tab.

> **Not real security.** Accounts live in `auth.js` and sessions in the browser, so anyone can read or bypass them. Before real use, replace `Auth.login()` with a real backend (for example Firebase Auth, Supabase or the college's SSO) and check roles on the server.

## Files
- `login.html`, `login.js` — role-based sign-in page
- `auth.js` — demo accounts, session handling and page access guard
- `index.html` — student dashboard
- `faculty.html`, `faculty.js` — faculty dashboard (attendance marking, submissions, notices)
- `admin.html`, `admin.js` — admin console (user approvals, notices, activity)
- `timetable.js` — live timetable used by the student and faculty pages
- `icons.js` — shared SVG icons
- `styles.css` — responsive mobile-first design with dark mode
- `app.js` — shared header, account menu, navigation, install prompt
- `manifest.webmanifest` — Progressive Web App settings
- `sw.js` — service worker for offline app shell
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
This is a front-end demo only. All timetable, attendance, notices, profile and assignments are sample data. It is not connected to LNCT's official systems and does not store real attendance or login data. Replace demo data and add an authorized backend before real student use.
