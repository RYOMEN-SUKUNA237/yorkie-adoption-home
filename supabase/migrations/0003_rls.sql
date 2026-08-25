-- =====================================================================
-- Yorkshire Adoption Home - Row Level Security
-- =====================================================================
-- Threat model:
--   anon           -> the public website. May read published content,
--                     submit an application, join the waitlist.
--   authenticated  -> either an anonymous messenger visitor OR staff.
--                     Anonymous visitors have NO profiles row, so
--                     is_staff() is false for them.
--   staff/admin    -> a profiles row with is_active = true.
--
-- Applications are write-only for the public: anyone may submit one,
-- nobody but staff may read one back.
-- =====================================================================

alter table public.profiles            enable row level security;
alter table public.parents             enable row level security;
alter table public.puppies             enable row level security;
alter table public.puppy_vaccinations  enable row level security;
alter table public.puppy_dewormings    enable row level security;
alter table public.guides              enable row level security;
alter table public.applications        enable row level security;
alter table public.application_notes   enable row level security;
alter table public.waitlist            enable row level security;
alter table public.conversations       enable row level security;
alter table public.messages            enable row level security;
alter table public.site_settings       enable row level security;
alter table public.activity_log        enable row level security;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
drop policy if exists profiles_select_self_or_staff on public.profiles;
create policy profiles_select_self_or_staff on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Public content: parents, puppies, health records, guides
-- ---------------------------------------------------------------------
drop policy if exists parents_public_read on public.parents;
create policy parents_public_read on public.parents
  for select to anon, authenticated using (true);

drop policy if exists parents_staff_write on public.parents;
create policy parents_staff_write on public.parents
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists puppies_public_read on public.puppies;
create policy puppies_public_read on public.puppies
  for select to anon, authenticated
  using (is_published or public.is_staff());

drop policy if exists puppies_staff_write on public.puppies;
create policy puppies_staff_write on public.puppies
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists vaccinations_public_read on public.puppy_vaccinations;
create policy vaccinations_public_read on public.puppy_vaccinations
  for select to anon, authenticated
  using (exists (
    select 1 from public.puppies p
    where p.id = puppy_id and (p.is_published or public.is_staff())
  ));

drop policy if exists vaccinations_staff_write on public.puppy_vaccinations;
create policy vaccinations_staff_write on public.puppy_vaccinations
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists dewormings_public_read on public.puppy_dewormings;
create policy dewormings_public_read on public.puppy_dewormings
  for select to anon, authenticated
  using (exists (
    select 1 from public.puppies p
    where p.id = puppy_id and (p.is_published or public.is_staff())
  ));

drop policy if exists dewormings_staff_write on public.puppy_dewormings;
create policy dewormings_staff_write on public.puppy_dewormings
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists guides_public_read on public.guides;
create policy guides_public_read on public.guides
  for select to anon, authenticated
  using (is_published or public.is_staff());

drop policy if exists guides_staff_write on public.guides;
create policy guides_staff_write on public.guides
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------
-- applications - write-only for the public
-- ---------------------------------------------------------------------
drop policy if exists applications_public_insert on public.applications;
create policy applications_public_insert on public.applications
  for insert to anon, authenticated
  with check (
    -- A submission must arrive as a genuine pending application. The
    -- score is overwritten by the trigger regardless of what is sent.
    status = 'pending'
    and reviewed_at is null
    and reviewed_by is null
    and will_return
    and will_spay_neuter
    and understands_decline
  );

drop policy if exists applications_staff_read on public.applications;
create policy applications_staff_read on public.applications
  for select to authenticated using (public.is_staff());

drop policy if exists applications_staff_update on public.applications;
create policy applications_staff_update on public.applications
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists applications_admin_delete on public.applications;
create policy applications_admin_delete on public.applications
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- application_notes - staff only, both directions
-- ---------------------------------------------------------------------
drop policy if exists application_notes_staff_read on public.application_notes;
create policy application_notes_staff_read on public.application_notes
  for select to authenticated using (public.is_staff());

drop policy if exists application_notes_staff_insert on public.application_notes;
create policy application_notes_staff_insert on public.application_notes
  for insert to authenticated with check (public.is_staff());

drop policy if exists application_notes_author_delete on public.application_notes;
create policy application_notes_author_delete on public.application_notes
  for delete to authenticated
  using (public.is_admin() or (public.is_staff() and author_id = auth.uid()));

-- ---------------------------------------------------------------------
-- waitlist - public may join, only staff may read
-- ---------------------------------------------------------------------
drop policy if exists waitlist_public_insert on public.waitlist;
create policy waitlist_public_insert on public.waitlist
  for insert to anon, authenticated
  with check (status = 'active');

drop policy if exists waitlist_staff_read on public.waitlist;
create policy waitlist_staff_read on public.waitlist
  for select to authenticated using (public.is_staff());

drop policy if exists waitlist_staff_write on public.waitlist;
create policy waitlist_staff_write on public.waitlist
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists waitlist_staff_delete on public.waitlist;
create policy waitlist_staff_delete on public.waitlist
  for delete to authenticated using (public.is_staff());

-- ---------------------------------------------------------------------
-- conversations - a visitor sees exactly their own thread
-- ---------------------------------------------------------------------
drop policy if exists conversations_owner_read on public.conversations;
create policy conversations_owner_read on public.conversations
  for select to authenticated
  using (visitor_id = auth.uid() or public.is_staff());

drop policy if exists conversations_owner_insert on public.conversations;
create policy conversations_owner_insert on public.conversations
  for insert to authenticated
  with check (visitor_id = auth.uid());

-- A visitor may edit their own name/email but may not reassign the
-- thread to someone else.
drop policy if exists conversations_owner_update on public.conversations;
create policy conversations_owner_update on public.conversations
  for update to authenticated
  using (visitor_id = auth.uid() or public.is_staff())
  with check (visitor_id = auth.uid() or public.is_staff());

drop policy if exists conversations_staff_delete on public.conversations;
create policy conversations_staff_delete on public.conversations
  for delete to authenticated using (public.is_staff());

-- ---------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------
drop policy if exists messages_participant_read on public.messages;
create policy messages_participant_read on public.messages
  for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.visitor_id = auth.uid()
    )
  );

-- A visitor can only post as 'visitor' into their own thread; only staff
-- can post as 'admin'. Without the sender_role check a visitor could
-- forge a message that renders as coming from the breeder.
drop policy if exists messages_visitor_insert on public.messages;
create policy messages_visitor_insert on public.messages
  for insert to authenticated
  with check (
    (
      sender_role = 'visitor'
      and exists (
        select 1 from public.conversations c
        where c.id = conversation_id and c.visitor_id = auth.uid()
      )
    )
    or (
      sender_role in ('admin', 'system')
      and public.is_staff()
    )
  );

drop policy if exists messages_staff_delete on public.messages;
create policy messages_staff_delete on public.messages
  for delete to authenticated using (public.is_staff());

-- ---------------------------------------------------------------------
-- site_settings
-- ---------------------------------------------------------------------
drop policy if exists site_settings_public_read on public.site_settings;
create policy site_settings_public_read on public.site_settings
  for select to anon, authenticated
  using (is_public or public.is_staff());

drop policy if exists site_settings_staff_write on public.site_settings;
create policy site_settings_staff_write on public.site_settings
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------
-- activity_log - readable by staff, written only by triggers
-- ---------------------------------------------------------------------
drop policy if exists activity_log_staff_read on public.activity_log;
create policy activity_log_staff_read on public.activity_log
  for select to authenticated using (public.is_staff());

drop policy if exists activity_log_staff_insert on public.activity_log;
create policy activity_log_staff_insert on public.activity_log
  for insert to authenticated with check (public.is_staff());
