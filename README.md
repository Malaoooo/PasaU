# PasaU

Pass it on to the next batch. A student-to-student marketplace for eight Baguio schools: sell, swap or give away textbooks, uniforms and school supplies, then meet on campus and confirm the handover with a 6-digit code.

Live: https://unicycle-seven.vercel.app

## Stack

- Static HTML, CSS and vanilla JavaScript, no build step, hosted on Vercel.
- Supabase: Postgres with row-level security, email accounts, Realtime chat, Storage and pg_cron.
- `config.js` holds the Supabase **publishable** key, which is public by design. Never commit the secret / service_role key.

## Files

- `index.html`, `unimatch.html`, `profile.html`, `messages.html`, `family.html`, `admin.html`: the pages. `family.html` is for parents and guardians (sign-up with a student's invite, then their dashboard; `family.js`).
- `site.css` (tokens and layout), `app.css` (features), `app.js` (shop, listings, deals), `messenger.js` (chat pop-up), `nav.js` (inner-page menu).
- `db/*.sql`: database setup, run in order in the Supabase SQL editor. `db/demo-cleanup.sql` hides test data.
- `logos/`: PasaU and PasaMatch marks.
- `PRODUCT.md`: product context, users and brand rules.

## Run locally

```bash
python -m http.server 8780
```

Then open http://localhost:8780.

## Deploy

```bash
npx vercel --prod
```
