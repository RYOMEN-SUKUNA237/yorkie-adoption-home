# Backend — Supabase

Everything the site stores lives here: schema, security policies, storage
buckets, seed content and one edge function.

---

## 1. Create the project

[supabase.com](https://supabase.com/dashboard) → **New project**. Any region;
the free tier is enough to start. Keep the database password somewhere safe.

## 2. Run the migrations

Open **SQL Editor** and run these files in order. Each is idempotent, so a
re-run is safe.

| Order | File | What it does |
| ----- | ---- | ------------ |
| 1 | `migrations/0001_schema.sql` | Tables, enums, indexes |
| 2 | `migrations/0002_functions.sql` | Triggers, scoring rubric, dashboard stats |
| 3 | `migrations/0003_rls.sql` | Row-level security policies |
| 4 | `migrations/0004_storage.sql` | Storage buckets and their policies |
| 5 | `migrations/0005_realtime.sql` | Realtime publication for the messenger |
| 6 | `migrations/0006_submit_application.sql` | The public submission RPC |
| 7 | `seed.sql` | The sample puppies, guides and default settings |

Or run them all from the repo, which is what these scripts are for:

```bash
npm run db:migrate    # migrations only
npm run db:reset      # migrations + seed
npm run db:verify     # assert schema, RLS, buckets, realtime, seed, scoring
npm run db:check      # exercise the anon key against the live policies
```

`db:migrate` needs `DIRECT_URL` in `.env.local` — the **session**-mode pooler
on port **5432**. The transaction pooler on 6543 cannot run DDL; the script
refuses it with a message rather than failing halfway.

`db:verify` connects as the `postgres` superuser, which bypasses RLS and so
proves nothing about what a visitor can do. `db:check` is the one that
matters for the policies: it uses the publishable key over PostgREST and
GoTrue, exactly as the browser does.

`seed.sql` is generated from the original content files — regenerate it with
`npm run seed` rather than editing it by hand.

## 3. Enable anonymous sign-ins

**Authentication → Providers → Anonymous → Enable.**

This is required for the floating messenger. Visitors do not create accounts;
an anonymous session gives each browser a real `auth.uid()`, which is what the
RLS policies scope their conversation to. Without it the messenger falls back
to showing your email and WhatsApp link.

## 4. Point the app at the project

```bash
cp .env.example .env.local
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from
**Project Settings → API**, then restart the dev server.

## 5. Create your admin account

**Authentication → Users → Add user** with a password.

A trigger on `auth.users` creates the matching `profiles` row. The **first**
account to exist becomes `admin`; everyone after is `staff` until an admin
promotes them in dashboard Settings. Anonymous messenger visitors are skipped
by that trigger, so they never gain dashboard access.

---

## Schema

```
profiles ─────────── staff accounts (1:1 with auth.users); a row here IS dashboard access
parents ──────────── sires and dams + health_tests jsonb
puppies ──────────── sire_id / dam_id → parents
  ├── puppy_vaccinations
  └── puppy_dewormings
guides ───────────── sections jsonb, rendered in order
applications ─────── the 8-step form, one row per submission
  └── application_notes ── internal review timeline (system + staff notes)
waitlist ─────────── joined from the site or after a declined application
conversations ────── one thread per visitor, keyed by their anonymous auth.uid()
  └── messages ───── visitor / admin / system
site_settings ────── key → jsonb, editable from the dashboard
activity_log ─────── audit trail written by triggers
```

Age is **not** stored. `puppies.date_of_birth` is the fact; weeks-old is
derived at read time by `puppy_age_weeks()` and by `ageInWeeks()` on the
client, so a record never silently goes stale.

## Security model

| Role | Can do |
| ---- | ------ |
| `anon` | Read published puppies and guides; **submit** an application; join the waitlist |
| anonymous visitor (authenticated) | The above, plus read and write **their own** conversation |
| `staff` | Read and manage everything except team membership and deletes |
| `admin` | Everything, including promoting staff and deleting records |

Two properties are worth stating explicitly:

- **Applications are write-only for the public.** Anyone may insert one;
  nobody without a `profiles` row may read one back. The insert policy also
  requires `status = 'pending'` and all three commitments, so a crafted
  request cannot self-approve.

  This has a consequence worth knowing: `INSERT ... RETURNING` needs SELECT
  permission on the new row, so `insert().select()` is **refused for anon**.
  That is why submission goes through the `submit_application(payload jsonb)`
  RPC (`0006`) instead — it is `SECURITY DEFINER`, returns only the id,
  reference and score, and re-checks by hand every invariant the RLS policy
  enforced. If you ever edit that function, keep those checks: SECURITY
  DEFINER means RLS is not protecting you inside it.
- **A visitor cannot forge a reply from the breeder.** The `messages` insert
  policy ties `sender_role = 'visitor'` to owning the conversation, and
  `sender_role IN ('admin','system')` to `is_staff()`.

`is_staff()` and `is_admin()` are `SECURITY DEFINER` so the policies on
`profiles` do not recurse when they consult it.

## Scoring

Applications are scored 0–10 by `score_application()` in
`0002_functions.sql`, applied by a `BEFORE INSERT OR UPDATE` trigger.

| Factor | Max | Notes |
| ------ | --- | ----- |
| Hours alone | 2.0 | Heaviest factor — this is a companion breed |
| Housing security | 1.5 | Own > rent-with-permission > rent-unconfirmed |
| Secure outdoor space | 1.5 | |
| Dog experience | 1.5 | Detailed history scores above a bare "yes" |
| Home type | 1.0 | |
| Household support | 1.0 | |
| Commitments | 1.0 | All three, or nothing |
| Care planning | 0.5 | Measured on the free-text answers |

The score is computed **in the database**, not the browser: the trigger
overwrites whatever a client sends, so it cannot be forged, and changing the
rubric re-scores consistently. `src/lib/scoring.ts` mirrors it for the live
preview shown in the form and dashboard — **update both together.**

## Storage

| Bucket | Public | Contents |
| ------ | ------ | -------- |
| `puppy-photos` | yes | Gallery images, 10 MB cap |
| `guide-images` | yes | Guide covers |
| `message-files` | no | Messenger attachments, foldered by uploader uid, served via signed URLs |

## Edge function (optional)

`functions/send-notification` emails you when an application or a visitor
message arrives.

```bash
supabase functions deploy send-notification
supabase secrets set RESEND_API_KEY=re_... NOTIFY_EMAIL=you@example.com SITE_URL=https://your-site
```

Then add a **Database Webhook** (Database → Webhooks) on `INSERT` for
`public.applications` and `public.messages` pointing at the function. It is
safe to skip — without the secrets it logs and returns 200 rather than
failing, because a missing mail provider must never break a submission.

## Resetting

```sql
-- Destroys all data.
drop schema public cascade;
create schema public;
grant usage on schema public to anon, authenticated, service_role;
```

Then re-run the migrations from step 2.
