-- =====================================================================
-- 0011_secure_and_extend_logs.sql
--
-- Two jobs.
--
-- 1. Close a data leak. Migration 0010 granted `anon` select, update and
--    delete on public.emails and public.whatsapp_logs. Those tables hold
--    every client email body and phone number, so anybody holding the
--    publishable key — which ships in the browser bundle by design — could
--    read the entire archive and delete it. Note that Supabase gives
--    anonymous sign-ins the `authenticated` role too, so `to authenticated`
--    was no better; the rest of this schema gates staff reads behind
--    public.is_staff(), and these two tables now do the same.
--
--    Inserts stay open to `anon`, matching applications_public_insert: the
--    serverless functions write with the publishable key, and a write-only
--    policy cannot be used to read anything back. Set
--    SUPABASE_SERVICE_ROLE_KEY in Vercel and even that closes.
--
-- 2. Record what the providers tell us — message ids, so a webhook retry can
--    be deduplicated and a delivery event can find its row, and the provider
--    error, so a failed WhatsApp send stops looking like a successful one.
-- =====================================================================

-- ---------------------------------------------------------------------
-- emails
-- ---------------------------------------------------------------------
alter table public.emails
  add column if not exists provider_id text;

comment on column public.emails.provider_id is
  'Resend message id. Used to deduplicate webhook retries and to apply delivery events.';

-- Partial, so the many rows without a provider id do not collide.
create unique index if not exists emails_provider_id_key
  on public.emails (provider_id)
  where provider_id is not null;

create index if not exists emails_unread_idx
  on public.emails (created_at desc)
  where read_at is null;

revoke all on table public.emails from anon;
grant insert on table public.emails to anon;
grant all on table public.emails to authenticated, service_role;

alter table public.emails enable row level security;

-- Clear out every policy 0008 and 0010 left behind, under both names, and
-- this migration's own names too: the runner replays every file on each run,
-- so a bare `create policy` fails the second time through.
drop policy if exists "Anon/Server can insert emails" on public.emails;
drop policy if exists "Staff can insert emails"       on public.emails;
drop policy if exists "Staff can view emails"         on public.emails;
drop policy if exists "Admins can view emails"        on public.emails;
drop policy if exists "Admins can delete emails"      on public.emails;
drop policy if exists "Admins can update emails"      on public.emails;
drop policy if exists emails_server_insert            on public.emails;
drop policy if exists emails_staff_read               on public.emails;
drop policy if exists emails_staff_update             on public.emails;
drop policy if exists emails_admin_delete             on public.emails;

-- Write-only for the serverless functions and the public site.
create policy emails_server_insert on public.emails
  for insert to anon, authenticated with check (true);

-- Reading the archive is staff-only.
create policy emails_staff_read on public.emails
  for select to authenticated using (public.is_staff());

create policy emails_staff_update on public.emails
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

create policy emails_admin_delete on public.emails
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- whatsapp_logs
-- ---------------------------------------------------------------------
alter table public.whatsapp_logs
  add column if not exists provider            text,
  add column if not exists provider_message_id text,
  add column if not exists error               text;

comment on column public.whatsapp_logs.provider is
  'Which gateway carried the message: meta, twilio, or none when nothing was configured.';
comment on column public.whatsapp_logs.error is
  'Verbatim provider error. Meta code 131047 means the 24-hour service window has closed and an approved template is required.';

-- 'generated' was the old value for "a wa.me link exists, a human must press
-- send". Nothing generates those any more; the honest label is 'failed'.
update public.whatsapp_logs
   set status = 'failed',
       error  = coalesce(error, 'Logged before automated delivery existed; never actually sent.')
 where status = 'generated';

alter table public.whatsapp_logs
  drop constraint if exists whatsapp_logs_status_check;

alter table public.whatsapp_logs
  add constraint whatsapp_logs_status_check
  check (status in ('sent', 'delivered', 'read', 'failed'));

create index if not exists whatsapp_logs_status_idx
  on public.whatsapp_logs (status, created_at desc);

revoke all on table public.whatsapp_logs from anon;
grant insert on table public.whatsapp_logs to anon;
grant all on table public.whatsapp_logs to authenticated, service_role;

alter table public.whatsapp_logs enable row level security;

drop policy if exists "Anon/Server can insert whatsapp_logs" on public.whatsapp_logs;
drop policy if exists "Staff can insert whatsapp_logs"       on public.whatsapp_logs;
drop policy if exists "Staff can view whatsapp_logs"         on public.whatsapp_logs;
drop policy if exists "Admins can view whatsapp_logs"        on public.whatsapp_logs;
drop policy if exists "Admins can delete whatsapp_logs"      on public.whatsapp_logs;
drop policy if exists whatsapp_logs_server_insert            on public.whatsapp_logs;
drop policy if exists whatsapp_logs_staff_read               on public.whatsapp_logs;
drop policy if exists whatsapp_logs_staff_update             on public.whatsapp_logs;
drop policy if exists whatsapp_logs_admin_delete             on public.whatsapp_logs;

create policy whatsapp_logs_server_insert on public.whatsapp_logs
  for insert to anon, authenticated with check (true);

create policy whatsapp_logs_staff_read on public.whatsapp_logs
  for select to authenticated using (public.is_staff());

create policy whatsapp_logs_staff_update on public.whatsapp_logs
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

create policy whatsapp_logs_admin_delete on public.whatsapp_logs
  for delete to authenticated using (public.is_admin());
