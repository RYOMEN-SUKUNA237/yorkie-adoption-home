-- Migration: 0010_fix_site_settings_defaults.sql
-- Update public contact email to the professional domain address.

insert into public.site_settings (key, value, is_public)
values
  ('contact_email', '"support@yorkieadoptionhome.com"', true)
on conflict (key)
  do update set value = excluded.value, updated_at = now()
  where public.site_settings.value::text = '"ntuhgireseelezanw@gmail.com"';

-- Ensure whatsapp_number is seeded
insert into public.site_settings (key, value, is_public)
values
  ('whatsapp_number', '"18587986768"', true)
on conflict (key)
  do nothing;
