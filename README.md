# Yorkshire Adoption Home

A Yorkshire Terrier adoption site for a small, selective breeder: a public
marketing site, an 8-step adoption application that is scored automatically, a
staff dashboard, and a realtime in-app messenger.

Built on Vite + React + Tailwind v4 with a Supabase backend. Steel blue and
tan, after the breed's own colouring — a warm bone ground, charcoal ink, tan
call-to-action and steel-blue accents, set in Newsreader and Outfit.

This project is entirely self-contained: its own database, repository and
deployment, sharing nothing with any other site.

---

## Running it

```bash
npm install
npm run dev
```

It runs immediately with no configuration — the public site falls back to the
bundled sample content so you can browse the design as-is. Nothing is stored
until you connect a database, and `/admin` shows a setup guide instead of a
login form.

To connect the backend, follow **[supabase/README.md](supabase/README.md)**.
The short version:

1. Create a Supabase project
2. Run `supabase/migrations/*.sql` in order, then `supabase/seed.sql`
3. Enable **Authentication → Providers → Anonymous** (the messenger needs it)
4. `cp .env.example .env.local` and fill in the URL and anon key
5. Add a user under Authentication → Users — the first one becomes the admin

| Script | Does |
| ------ | ---- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run preview` | Serve the build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run seed` | Regenerate `supabase/seed.sql` from `src/data/*` (fails on a reused photograph) |
| `npm run db:migrate` | Apply `supabase/migrations/*.sql` |
| `npm run db:reset` | Migrations + seed |
| `npm run db:verify` | Assert schema, RLS, buckets, realtime, seed, scoring |
| `npm run db:check` | Exercise the anon key against the live RLS policies, the messenger and realtime end to end |

---

## What is here

### Public site
`/` `/puppies` `/puppies/:slug` `/guides` `/guides/:slug` `/about`
`/apply` `/apply/received` `/apply/declined`

The application is eight steps with per-step validation. On the review step it
shows the applicant **how their answers read against the rubric, and why** —
the same breakdown the breeder sees. On submit it returns a reference number
(`APP-0001`). The breeder can pause applications from the dashboard, which
swaps the form for an explanation.

### Admin dashboard — `/admin`
Gated on a `profiles` row, not merely on being signed in: anonymous messenger
visitors also hold a session and must never reach it.

| Route | Does |
| ----- | ---- |
| `/admin` | Metrics, 30-day chart, pipeline, recent applications, activity |
| `/admin/applications` | Search, filter, sort, paginate; detail drawer with score breakdown, review timeline, decisions, CSV export |
| `/admin/messages` | Realtime inbox — two panes on desktop, one at a time on phones |
| `/admin/puppies` | Full CRUD, photo upload and reordering, vaccination and deworming records, inline parent creation |
| `/admin/guides` | Article editor with reorderable sections and reading-time estimate |
| `/admin/waitlist` | Status tracking and CSV export |
| `/admin/settings` | Contact details, messenger copy, application toggle, team roles |

### Messenger
A floating button on every public page except the application form, where a
panel over a focused task would be noise.

- Visitors never sign up — an anonymous Supabase session gives RLS a subject
  to scope the thread to, and returns the same browser to the same
  conversation later
- Realtime both directions, with unread badges that survive a closed panel
- File attachments through a private bucket and signed URLs
- Full-screen sheet on phones, docked card from `sm` up
- Degrades to your email and WhatsApp link if the service is unreachable,
  with a **Try again** button — a visitor whose first load raced a dropped
  connection should not be stuck on the fallback for the whole session

Anonymous sign-ins must be enabled (Authentication → Providers → Anonymous)
or the panel shows that fallback and nothing else. `npm run db:check` says so
in as many words when it is off, and when it is on it proves the whole path:
thread resume, history, read receipts, a realtime round-trip, and that a
second visitor cannot read the first one's thread.

`db:check` submits real applications, because a mock would prove nothing
about the RPC or the scoring trigger. It deletes them again afterwards over
`DIRECT_URL` — the anon key that created them has no DELETE policy, by
design — so running it repeatedly leaves no residue in the dashboard.

---

## Architecture

```
src/
  lib/           supabase client, auth + settings contexts, models,
                 scoring mirror, formatting
  services/      all data access — puppies, guides, applications,
                 messages, misc (waitlist/settings/storage/stats)
  hooks/         useAsync, useDebounced, useMediaQuery, useLocalStorage
  app/
    pages/       public pages
    pages/admin/ dashboard
    components/  Messenger, PuppyCard, admin/ui primitives, shadcn ui/
  data/          original static content — the fallback, and the seed source
supabase/
  migrations/    schema → functions → RLS → storage → realtime
  functions/     send-notification edge function
  seed.sql       generated; run `npm run seed`
```

Three decisions worth knowing:

**Pages never touch Supabase directly.** Everything goes through
`src/services/*`, which returns camelCase domain models. That is what let the
Figma-exported components keep their original shape while the database uses
snake_case, and it is where the no-backend fallback lives.

**Scoring runs in Postgres.** A `BEFORE INSERT` trigger computes the score, so
a client cannot forge one and a rubric change re-scores consistently.
`src/lib/scoring.ts` mirrors it purely for the live preview — the two are
meant to be edited together.

The rubric is breed-specific and sums to 10:

| Factor | Max | Why |
| ------ | --- | --- |
| Hours alone | 2.00 | Yorkshire Terriers are strongly predisposed to separation anxiety |
| Housing security | 1.50 | Own > rent-with-permission > rent-unconfirmed |
| Dog experience | 1.50 | A detailed history scores above a bare "yes" |
| Secure outdoor space | 1.25 | Terriers dig and squeeze through what holds a bigger dog |
| Household support | 1.00 | |
| Commitments | 1.00 | All three, or nothing |
| Handling risk | 0.75 | Youngest child's age — an adult weighs 2-3kg |
| Home type | 0.75 | Weighted lower than for a quiet breed; barking matters in a flat |
| Care planning | 0.25 | Measured on the free-text answers |

**Submission goes through an RPC, not an insert.** `applications` has no
SELECT policy for the public, which also blocks `INSERT ... RETURNING` — so
the applicant could not be told their reference number. `submit_application()`
is a `SECURITY DEFINER` function that returns only the reference, keeping the
table unreadable. It re-validates every invariant by hand, because SECURITY
DEFINER bypasses the RLS that would otherwise enforce them.

**Derived values are not stored.** A puppy's age comes from its date of birth
at read time. Storing weeks-old would be wrong within seven days.

---

## Responsive

Mobile-first throughout, at Tailwind's `sm` 640 / `md` 768 / `lg` 1024 /
`xl` 1280.

- Public grids go 1 → 2 → 3 columns; dashboard metrics 1 → 2 → 4
- Admin tables become card lists below `md` — a six-column table is unusable
  on a phone
- The dashboard sidebar becomes a drawer below `lg`
- Drawers are full-width on phones, fixed-width panels above `sm`
- Tap targets stay at least 40px; `env(safe-area-inset-bottom)` keeps sticky
  bars clear of the iOS home indicator
- Body scroll locks behind overlays, and reduced-motion preferences are
  honoured

---

## Deployment

Production is Vercel, project `yorkshire-adoption-home`, deployed from `main`
with `vercel --prod`. `vercel.json` carries the SPA rewrite: without it every
route but `/` returns 404 on a hard refresh, because the client router owns
the paths.

The site is served at **yorkieadoptionhome.com**, registered at Northwest
Registered Agent, which also holds the DNS. Vercel treats `www` as the
primary hostname and 308-redirects the apex to it, so both records matter:

| Type | Host  | Value         |
| ---- | ----- | ------------- |
| A    | `@`   | `76.76.21.21` |
| A    | `www` | `76.76.21.21` |

A `CNAME` on `www` pointing at `cname.vercel-dns.com.` is the more usual
choice, and Northwest accepts it — with the trailing dot, as it rejects any
value that is not fully qualified. It was abandoned here: twenty minutes
after it was saved `ns2` served it while `ns1` still answered `NXDOMAIN` for
`www`, both reporting the *same* SOA serial, so roughly half of all lookups
failed. The A record that replaced it was consistent on both nameservers
within two minutes. Prefer the A records.

Three environment variables must exist in Vercel for every environment —
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_NAME`. Vite inlines
them at build time, so changing one needs a redeploy, not a restart.

Supabase has to be told the domain too, or password recovery breaks on it:
the reset link is built from `window.location.origin`, and GoTrue refuses a
`redirectTo` that is not allow-listed, falling back to the Site URL. Set
Authentication → URL Configuration → Site URL to
`https://www.yorkieadoptionhome.com`, and list both
`https://www.yorkieadoptionhome.com/**` and
`https://yorkieadoptionhome.com/**` as Redirect URLs.

---

## Notes

- `src/data/*.ts` is intentionally still present. It is the fallback content
  **and** the source `npm run seed` generates SQL from, so the sample copy
  stays in one place.
- No photograph may appear on two listings, and a listing only carries
  photographs of that dog. `npm run seed` fails rather than emitting SQL that
  breaks either rule — showing the same dog under two names is the one error
  an adoption page does not survive. The bundled images are Unsplash
  placeholders and are overwhelmingly of adult dogs; only the four youngest
  listings have a genuine puppy frame. Replace them with real photographs
  (Puppies → Edit → Upload) before going live.
- The build warns that the JS chunk is over 500 kB. It is a single bundle by
  design for a site this size; route-level `import()` is the fix if it matters
  for your hosting.

Photography credits are in [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
