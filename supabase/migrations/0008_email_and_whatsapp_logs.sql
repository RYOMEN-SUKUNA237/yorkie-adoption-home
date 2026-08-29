-- =====================================================================
-- 0008_email_and_whatsapp_logs.sql
-- Create emails and whatsapp_logs tables for Admin Webmail & Dispatch Tracking
-- =====================================================================

-- ---------------------------------------------------------------------
-- emails - Stores incoming client replies and outgoing messages
-- ---------------------------------------------------------------------
create table if not exists public.emails (
  id          uuid primary key default gen_random_uuid(),
  direction   text not null check (direction in ('incoming', 'outgoing')),
  from_email  text not null,
  from_name   text,
  to_email    text not null,
  subject     text not null,
  body_text   text,
  body_html   text,
  status      text not null default 'sent',
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists emails_direction_idx on public.emails (direction, created_at desc);
create index if not exists emails_to_idx on public.emails (to_email);
create index if not exists emails_from_idx on public.emails (from_email);

-- Enable RLS
alter table public.emails enable row level security;

-- Policies: Authenticated staff can read and insert emails
drop policy if exists "Staff can view emails" on public.emails;
create policy "Staff can view emails" on public.emails
  for select to authenticated using (true);

drop policy if exists "Staff can insert emails" on public.emails;
create policy "Staff can insert emails" on public.emails
  for insert to authenticated with check (true);

drop policy if exists "Anon/Server can insert emails" on public.emails;
create policy "Anon/Server can insert emails" on public.emails
  for insert to anon with check (true);

-- ---------------------------------------------------------------------
-- whatsapp_logs - Stores automated WhatsApp dispatches
-- ---------------------------------------------------------------------
create table if not exists public.whatsapp_logs (
  id              uuid primary key default gen_random_uuid(),
  recipient_phone text not null,
  recipient_name  text,
  reference       text,
  message         text not null,
  status          text not null default 'sent',
  created_at      timestamptz not null default now()
);

create index if not exists whatsapp_logs_created_idx on public.whatsapp_logs (created_at desc);
create index if not exists whatsapp_logs_phone_idx on public.whatsapp_logs (recipient_phone);

-- Enable RLS
alter table public.whatsapp_logs enable row level security;

drop policy if exists "Staff can view whatsapp_logs" on public.whatsapp_logs;
create policy "Staff can view whatsapp_logs" on public.whatsapp_logs
  for select to authenticated using (true);

drop policy if exists "Staff can insert whatsapp_logs" on public.whatsapp_logs;
create policy "Staff can insert whatsapp_logs" on public.whatsapp_logs
  for insert to authenticated with check (true);

drop policy if exists "Anon/Server can insert whatsapp_logs" on public.whatsapp_logs;
create policy "Anon/Server can insert whatsapp_logs" on public.whatsapp_logs
  for insert to anon with check (true);
