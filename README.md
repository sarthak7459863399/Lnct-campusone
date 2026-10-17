# LNCT CampusOne

A mobile-first, installable **prototype** for a college student dashboard.

## Files
- `index.html` — app structure and sample content
- `styles.css` — responsive mobile-first design
- `app.js` — navigation, demo interactions, install prompt
- `manifest.webmanifest` — Progressive Web App settings
- `sw.js` — service worker for offline app shell
- `icons/` — app icons

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
