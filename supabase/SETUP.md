# Connecting CampusOne to Supabase

About 10 minutes. You only do this once.

## 1. Create the database
1. Open your project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor → New query**.
3. Paste everything from [`schema.sql`](schema.sql) and click **Run**. You should see "Success. No rows returned".

This creates the tables (profiles, courses, timetable, attendance, notices, assignments, submissions, activity log), the security rules that decide who can see and change what, and the functions the website calls.

## 2. Turn off public sign-ups
Only admins should create accounts.

**Authentication → Sign In / Providers → Email**: keep **Email** enabled, and turn **off** "Allow new users to sign up" (in some dashboard versions this is under **Authentication → Settings**).

Even if sign-ups were left on, a new account is always a *pending student* that can't see any data until an admin approves it.

## 3. Set the website address (needed for password-reset emails)
**Authentication → URL Configuration**
- **Site URL**: `https://sarthak7459863399.github.io/Lnct-campusone/`
- **Redirect URLs**: add
  - `https://sarthak7459863399.github.io/Lnct-campusone/reset.html`
  - `http://localhost:5173/reset.html` (for testing on your computer)

Change these if you host the site somewhere else.

## 4. Create the first three accounts
**Authentication → Users → Add user → Create new user**. For each, enter an email and password and tick **Auto Confirm User**:
- one student
- one faculty member
- one admin (you)

## 5. Give them roles and add sample data
1. Open [`seed.sql`](seed.sql), and replace the three example emails near the top with the ones you just created.
2. Paste it into **SQL Editor → New query** and click **Run**.

This makes the accounts a student (section CSE-A), a faculty member who teaches Maths to CSE-A and CSE-B, and an admin. It also adds a Monday–Saturday timetable, a few notices and assignments, and a month of attendance history so the dashboards aren't empty.

## 6. Connect the website
**Project Settings → API** (or the **Connect** button at the top of the dashboard). Copy:
- **Project URL**, for example `https://abcdefghijkl.supabase.co`
- **anon public** key (or the **publishable** key, which starts with `sb_publishable_`)

Paste them into [`../config.js`](../config.js).

Both values are designed to be public and are safe to commit. **Never** use the `service_role` / `secret` key in the website.

## 7. Try it
Open the site, choose the role, and sign in with each account.

## 8. Let admins add accounts from the website
This lets the admin console create accounts, set new passwords and delete accounts. Creating logins needs Supabase's secret service-role key, so it runs in a small **Edge Function** on Supabase's servers. The key never reaches the browser, and the function refuses anyone who isn't an approved admin.

1. **Update the database** (only if you ran `schema.sql` before this feature was added): **SQL Editor → New query**, paste [`migrations/002_admin_accounts.sql`](migrations/002_admin_accounts.sql), **Run**. It adds an email column to profiles so the admin console can show emails.
2. **Deploy the function:** **Edge Functions → Deploy a new function → Via Editor**.
   - Name it exactly `admin-users`.
   - Replace the example code with everything from [`functions/admin-users/index.ts`](functions/admin-users/index.ts).
   - Click **Deploy function**.
3. **Turn off "Verify JWT"** for the function: **Edge Functions → admin-users → Details** (or Settings), switch off **Enforce JWT verification / Verify JWT**, and save. The function checks the signed-in admin itself, and this setting can wrongly reject valid sign-ins on projects that use the new API keys.

Nothing else is needed. Supabase gives the function its project URL and service-role key automatically.

If you prefer the command line, the Supabase CLI does the same: `supabase functions deploy admin-users --no-verify-jwt --project-ref cdbilhwxbvngzsretykp`.

## Day-to-day admin
- **Add a person:** admin console → **Add user**. Enter their name, email, a starting password, role and details. They can sign in straight away; tell them the password and ask them to change it with "Forgot password?".
- **Change someone's details, role or section, or set a new password:** admin console → **Edit**.
- **Remove a person:** admin console → **Edit** → **Delete account**. Their profile, attendance and submissions are removed with them.
- Accounts made directly in Supabase (Authentication → Users → Add user) still work: they show up as **Pending** in the admin console until you approve them.
- **Timetable and courses:** for now, edit them in Supabase → **Table Editor** → `timetable_slots` / `courses`. `day_of_week` is 0 = Sunday … 6 = Saturday. To let a faculty member mark attendance for a class, put their user id in `faculty_id` on that class's slots.

## Who can do what
Enforced by the database (row-level security), not by the website code:

| | Student | Faculty | Admin |
|---|---|---|---|
| Own profile, timetable, attendance | ✓ | ✓ | ✓ |
| See other people's profiles | – | ✓ | ✓ |
| Mark attendance | – | Only classes they teach | ✓ |
| Post notices | – | Only to sections they teach | To everyone / students / faculty |
| Create assignments | – | Only for classes they teach | ✓ |
| Submit assignments | Own section | – | – |
| Add, approve, edit and delete accounts | – | – | ✓ |
| Activity log | – | – | ✓ |

Pending (unapproved) accounts can sign in to Supabase but see no data, and the website signs them straight back out.
