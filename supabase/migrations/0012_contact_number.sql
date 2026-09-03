-- Contact number change.
--
-- site_settings is the live source of truth: the pages read `contact_phone`
-- and `whatsapp_number` from here and only fall back to the values compiled
-- into the bundle when the row is missing. Changing the code alone would
-- leave the old number on the site, so it is changed in both places.
--
-- `contact_phone` is the human-readable form shown in the footer, the About
-- page and the email signature. `whatsapp_number` is digits only, country
-- code included, because it goes straight into a wa.me URL.

insert into public.site_settings (key, value, is_public)
values
  ('contact_phone',   '"+1 (858) 798-6768"'::jsonb, true),
  ('whatsapp_number', '"18587986768"'::jsonb,       true)
on conflict (key)
  do update set value = excluded.value, updated_at = now();
