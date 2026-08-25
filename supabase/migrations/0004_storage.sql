-- =====================================================================
-- Yorkshire Adoption Home - Storage buckets
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('puppy-photos',  'puppy-photos',  true,  10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('guide-images',  'guide-images',  true,  10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('message-files', 'message-files', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- Public image buckets: world-readable, staff-writable
-- ---------------------------------------------------------------------
drop policy if exists "public images are readable" on storage.objects;
create policy "public images are readable" on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('puppy-photos', 'guide-images'));

drop policy if exists "staff upload images" on storage.objects;
create policy "staff upload images" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('puppy-photos', 'guide-images') and public.is_staff());

drop policy if exists "staff update images" on storage.objects;
create policy "staff update images" on storage.objects
  for update to authenticated
  using (bucket_id in ('puppy-photos', 'guide-images') and public.is_staff());

drop policy if exists "staff delete images" on storage.objects;
create policy "staff delete images" on storage.objects
  for delete to authenticated
  using (bucket_id in ('puppy-photos', 'guide-images') and public.is_staff());

-- ---------------------------------------------------------------------
-- Message attachments: private, foldered by the uploader's user id.
-- A visitor can only touch objects under `message-files/<their uid>/`.
-- ---------------------------------------------------------------------
drop policy if exists "message files readable by owner or staff" on storage.objects;
create policy "message files readable by owner or staff" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'message-files'
    and (public.is_staff() or (storage.foldername(name))[1] = auth.uid()::text)
  );

drop policy if exists "message files uploadable by owner" on storage.objects;
create policy "message files uploadable by owner" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'message-files'
    and (public.is_staff() or (storage.foldername(name))[1] = auth.uid()::text)
  );

drop policy if exists "message files deletable by owner or staff" on storage.objects;
create policy "message files deletable by owner or staff" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'message-files'
    and (public.is_staff() or (storage.foldername(name))[1] = auth.uid()::text)
  );
