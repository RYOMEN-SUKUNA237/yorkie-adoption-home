-- Migration: 0010_fix_site_settings_defaults.sql
-- 1. Update contact_email and whatsapp_number in site_settings
insert into public.site_settings (key, value, is_public)
values
  ('contact_email', '"support@yorkieadoptionhome.com"'::jsonb, true),
  ('whatsapp_number', '"18587986768"'::jsonb, true)
on conflict (key)
  do update set value = excluded.value, updated_at = now();

-- 2. Ensure emails and whatsapp_logs have correct table grants and RLS insert permissions
grant all on table public.emails to anon, authenticated, service_role;
grant all on table public.whatsapp_logs to anon, authenticated, service_role;

alter table public.emails enable row level security;
drop policy if exists "Anon/Server can insert emails" on public.emails;
create policy "Anon/Server can insert emails" on public.emails
  for insert to anon, authenticated with check (true);

drop policy if exists "Admins can view emails" on public.emails;
create policy "Admins can view emails" on public.emails
  for select to authenticated using (true);

drop policy if exists "Admins can delete emails" on public.emails;
create policy "Admins can delete emails" on public.emails
  for delete to authenticated using (true);

drop policy if exists "Admins can update emails" on public.emails;
create policy "Admins can update emails" on public.emails
  for update to authenticated using (true);

