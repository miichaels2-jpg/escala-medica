# AGENTS.md

## Project Context

ScaleMedic is a medical shift-scheduling web app (React + Vite + Tailwind) backed directly by Supabase. It is deployed on Vercel and is installable on phones as a PWA. Treat it as user-owned application code, keep changes focused on the user's request, and preserve existing project conventions. User-facing text is in Brazilian Portuguese.

Start with `README.md` for local setup, environment variables, database migrations and publishing.

## Key Files

- `src/lib/supabase.js`: the single Supabase client used by the whole app.
- `src/lib/useAppData.jsx`: global data store (company, units, professionals, sectors, shifts, published schedules, payment statuses) shared by all pages.
- `src/lib/AuthContext.jsx` and `src/pages/Login.jsx`: custom login (table `users`, RPC `auth_fallback_login`), not Supabase Auth.
- `src/lib/financialCalculations.js`, `src/lib/productivityCalculations.js`, `src/lib/shiftLiveStatus.js`: business rules shared by Dashboard, Escalas, Faturamento, Relatórios and Minha Escala. Change them in one place; never re-implement a rule inside a page.
- `src/lib/printBranding.js`: logos and HTML escaping for every printable document.
- `src/lib/pwa.js`, `public/manifest.webmanifest`, `public/sw.js`: installable app.
- `supabase/migrations/`: SQL to apply in the Supabase SQL Editor.
- `.env`: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (local only; never commit).

## Versioning

- Current version lives in `package.json` (`version`, without the "V") and is shown in the app as `V<version>`.
- Every production release bumps the last number: 0.1.2 → 0.1.3 … → 0.1.10; after 0.1.10 comes 0.2.1 (never x.y.0). See `nextVersion()` in `src/lib/version.js`.
- Each release gets a `CHANGELOG.md` entry and a git tag `vX.Y.Z`.

## Working Notes

- Run locally with `npm run dev`; it talks to the Supabase project configured in `.env`.
- New database objects ship as a migration file in `supabase/migrations/` and the app must keep working (with a clear fallback) until the migration is applied.
- Before finishing code changes run `npm run lint`, `node --test tests/*.test.js` and `npm run build`.
