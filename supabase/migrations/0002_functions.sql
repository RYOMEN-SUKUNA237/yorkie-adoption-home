-- =====================================================================
-- Yorkshire Adoption Home - functions & triggers
-- =====================================================================

-- ---------------------------------------------------------------------
-- Role helpers
-- ---------------------------------------------------------------------
-- SECURITY DEFINER so policies on `profiles` itself do not recurse.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active
  );
$fn$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role = 'admin'
  );
$fn$;

grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'parents', 'puppies', 'guides', 'applications',
    'waitlist', 'conversations', 'site_settings'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- New auth user -> profile
-- ---------------------------------------------------------------------
-- Only non-anonymous sign-ups become staff profiles. Anonymous visitors
-- (the messenger) must never land in `profiles`, or they would gain
-- dashboard access through is_staff().
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if coalesce((new.raw_app_meta_data ->> 'provider'), '') = 'anonymous'
     or new.is_anonymous is true then
    return new;
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    -- First account to exist becomes the admin; everyone after is staff.
    case when (select count(*) from public.profiles) = 0 then 'admin' else 'staff' end::user_role
  )
  on conflict (id) do nothing;

  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Application reference numbers: APP-0001
-- ---------------------------------------------------------------------
create or replace function public.next_application_reference()
returns text language sql volatile as $fn$
  select 'APP-' || lpad(nextval('public.application_reference_seq')::text, 4, '0');
$fn$;

-- ---------------------------------------------------------------------
-- Scoring rubric (0-10)
-- ---------------------------------------------------------------------
-- Lives in the database so the score cannot be forged by a client POST,
-- and so a rubric change re-scores consistently for everyone.
-- src/lib/scoring.ts mirrors this for the live preview in the form.
create or replace function public.score_application(app public.applications)
returns jsonb
language plpgsql
immutable
as $fn$
declare
  breakdown jsonb := '[]'::jsonb;
  total     numeric := 0;
  pts       numeric;
  reason    text;
  youngest  integer;
begin
  -- Hours alone (max 2.0)
  -- The heaviest factor. Yorkshire Terriers are strongly predisposed to
  -- separation anxiety, and it is the single most common reason a dog of
  -- this breed is returned to a breeder.
  if app.hours_alone <= 2 then
    pts := 2.0; reason := app.hours_alone || 'h alone per day';
  elsif app.hours_alone <= 4 then
    pts := 1.5; reason := app.hours_alone || 'h alone per day';
  elsif app.hours_alone <= 6 then
    pts := 1.0; reason := app.hours_alone || 'h alone per day';
  elsif app.hours_alone <= 8 then
    pts := 0.5; reason := app.hours_alone || 'h alone per day - a lot for this breed';
  else
    pts := 0; reason := app.hours_alone || 'h alone per day - longer than we place for';
  end if;
  total := total + pts;
  breakdown := breakdown || jsonb_build_object('label', 'Hours alone', 'points', pts, 'max', 2.0, 'reason', reason);

  -- Housing security (max 1.5)
  if app.ownership = 'own' then
    pts := 1.5; reason := 'Owns their home';
  elsif app.ownership = 'rent' and app.landlord_allows = 'yes' then
    pts := 1.0; reason := 'Renting with written landlord permission';
  elsif app.ownership = 'rent' and app.landlord_allows = 'unsure' then
    pts := 0.25; reason := 'Renting, landlord permission unconfirmed';
  else
    pts := 0; reason := 'Renting without landlord permission';
  end if;
  total := total + pts;
  breakdown := breakdown || jsonb_build_object('label', 'Housing security', 'points', pts, 'max', 1.5, 'reason', reason);

  -- Dog experience (max 1.5)
  if app.owned_before and length(coalesce(app.previous_dog_history, '')) >= 60 then
    pts := 1.5; reason := 'Previous owner, detailed history given';
  elsif app.owned_before then
    pts := 1.0; reason := 'Previous dog owner';
  else
    pts := 0.25; reason := 'First-time dog owner';
  end if;
  total := total + pts;
  breakdown := breakdown || jsonb_build_object('label', 'Dog experience', 'points', pts, 'max', 1.5, 'reason', reason);

  -- Secure outdoor space (max 1.25)
  -- Terriers dig, squeeze and follow a scent. A boundary that would hold a
  -- larger dog will not necessarily hold this one.
  if app.fenced_space = 'yes' then
    pts := 1.25; reason := 'Fully enclosed outdoor space';
  elsif app.fenced_space = 'partial' then
    pts := 0.6; reason := 'Partially enclosed - terriers find the gaps';
  else
    pts := 0; reason := 'No enclosed outdoor space';
  end if;
  total := total + pts;
  breakdown := breakdown || jsonb_build_object('label', 'Secure outdoor space', 'points', pts, 'max', 1.25, 'reason', reason);

  -- Household support (max 1.0)
  if app.adult_count >= 2 then
    pts := 1.0; reason := app.adult_count || ' adults in the household';
  elsif app.adult_count = 1 then
    pts := 0.5; reason := 'Single-adult household';
  else
    pts := 0; reason := 'Household size not given';
  end if;
  total := total + pts;
  breakdown := breakdown || jsonb_build_object('label', 'Household support', 'points', pts, 'max', 1.0, 'reason', reason);

  -- Commitments (max 1.0)
  if app.will_return and app.will_spay_neuter and app.understands_decline then
    pts := 1.0; reason := 'All three commitments accepted';
  else
    pts := 0; reason := 'Commitments incomplete';
  end if;
  total := total + pts;
  breakdown := breakdown || jsonb_build_object('label', 'Commitments', 'points', pts, 'max', 1.0, 'reason', reason);

  -- Handling risk (max 0.75)
  -- Specific to a two-to-three kilogram dog: most serious injuries in this
  -- breed come from ordinary household accidents. Young children are not a
  -- disqualifier, but they change what the placement needs.
  select min(m[1]::int) into youngest
    from regexp_matches(coalesce(app.children_ages, ''), '\d+', 'g') m;

  if youngest is null then
    pts := 0.75; reason := 'No young children in the household';
  elsif youngest >= 8 then
    pts := 0.75; reason := 'Youngest child is ' || youngest || ' - old enough to handle a very small dog';
  elsif youngest >= 5 then
    pts := 0.4; reason := 'Youngest child is ' || youngest || ' - workable with supervision';
  else
    pts := 0.1; reason := 'Youngest child is ' || youngest || ' - a 2kg dog is easily injured';
  end if;
  total := total + pts;
  breakdown := breakdown || jsonb_build_object('label', 'Handling risk', 'points', pts, 'max', 0.75, 'reason', reason);

  -- Home type (max 0.75)
  -- Weighted lower than for a quieter breed: a Yorkshire Terrier is happy in
  -- a flat, but a vocal dog behind thin walls is its own problem.
  if app.home_type in ('house', 'compound') then
    pts := 0.75; reason := 'House or compound';
  elsif app.home_type = 'apartment' then
    pts := 0.45; reason := 'Apartment - fine for the dog, worth thinking about the barking';
  else
    pts := 0; reason := 'Home type not given';
  end if;
  total := total + pts;
  breakdown := breakdown || jsonb_build_object('label', 'Home type', 'points', pts, 'max', 0.75, 'reason', reason);

  -- Care planning (max 0.25)
  if length(coalesce(app.travel_care, '')) >= 40 and length(coalesce(app.dog_sleeps, '')) >= 20 then
    pts := 0.25; reason := 'Sleeping and travel arrangements described in detail';
  elsif length(coalesce(app.travel_care, '')) >= 20 then
    pts := 0.1; reason := 'Care arrangements described briefly';
  else
    pts := 0; reason := 'Care arrangements not described';
  end if;
  total := total + pts;
  breakdown := breakdown || jsonb_build_object('label', 'Care planning', 'points', pts, 'max', 0.25, 'reason', reason);

  return jsonb_build_object(
    'score', round(least(10, greatest(0, total)), 1),
    'breakdown', breakdown
  );
end;
$fn$;

-- Score + reference are assigned server-side on insert, and re-scored
-- whenever an answer changes.
create or replace function public.apply_application_scoring()
returns trigger language plpgsql as $fn$
declare
  result jsonb;
begin
  if tg_op = 'INSERT' then
    if new.reference is null or new.reference = '' then
      new.reference := public.next_application_reference();
    end if;
  end if;

  result := public.score_application(new);
  new.score := (result ->> 'score')::numeric;
  new.score_breakdown := result -> 'breakdown';

  return new;
end;
$fn$;

drop trigger if exists apply_application_scoring on public.applications;
create trigger apply_application_scoring
  before insert or update on public.applications
  for each row execute function public.apply_application_scoring();

-- ---------------------------------------------------------------------
-- Status change -> system note on the review timeline
-- ---------------------------------------------------------------------
create or replace function public.log_application_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.application_notes (application_id, author_id, author_name, body, is_system)
    values (
      new.id,
      auth.uid(),
      (select full_name from public.profiles where id = auth.uid()),
      format('Status changed from %s to %s', old.status, new.status),
      true
    );

    insert into public.activity_log (actor_id, action, entity, entity_id, meta)
    values (
      auth.uid(),
      'application.status_changed',
      'application',
      new.id::text,
      jsonb_build_object('from', old.status, 'to', new.status, 'reference', new.reference)
    );
  end if;
  return new;
end;
$fn$;

drop trigger if exists log_application_status_change on public.applications;
create trigger log_application_status_change
  after update on public.applications
  for each row execute function public.log_application_status_change();

-- ---------------------------------------------------------------------
-- Messenger: keep conversation summary in sync with its messages
-- ---------------------------------------------------------------------
create or replace function public.bump_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.conversations
     set last_message_at      = new.created_at,
         last_message_preview = left(coalesce(nullif(trim(new.body), ''), new.attachment_name, 'Attachment'), 140),
         unread_for_admin     = case when new.sender_role = 'visitor'
                                     then unread_for_admin + 1 else unread_for_admin end,
         unread_for_visitor   = case when new.sender_role in ('admin', 'system')
                                     then unread_for_visitor + 1 else unread_for_visitor end,
         -- A reply on a closed thread reopens it.
         status               = case when status = 'closed' then 'open' else status end,
         updated_at           = now()
   where id = new.conversation_id;

  return new;
end;
$fn$;

drop trigger if exists bump_conversation on public.messages;
create trigger bump_conversation
  after insert on public.messages
  for each row execute function public.bump_conversation();

-- Visitors clear their own unread counter; staff clear the admin one.
create or replace function public.mark_conversation_read(p_conversation_id uuid, p_as text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if p_as = 'admin' then
    if not public.is_staff() then
      raise exception 'Only staff can mark a conversation read as admin';
    end if;
    update public.conversations set unread_for_admin = 0 where id = p_conversation_id;
    update public.messages set read_at = now()
     where conversation_id = p_conversation_id and sender_role = 'visitor' and read_at is null;
  else
    update public.conversations
       set unread_for_visitor = 0
     where id = p_conversation_id and visitor_id = auth.uid();
    update public.messages m set read_at = now()
     where m.conversation_id = p_conversation_id
       and m.sender_role in ('admin', 'system')
       and m.read_at is null
       and exists (
         select 1 from public.conversations c
         where c.id = m.conversation_id and c.visitor_id = auth.uid()
       );
  end if;
end;
$fn$;

grant execute on function public.mark_conversation_read(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Dashboard statistics - one round trip instead of eight
-- ---------------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  result jsonb;
begin
  if not public.is_staff() then
    raise exception 'Not authorised';
  end if;

  select jsonb_build_object(
    'applications', (
      select jsonb_build_object(
        'total',       count(*),
        'pending',     count(*) filter (where status = 'pending'),
        'reviewing',   count(*) filter (where status = 'reviewing'),
        'shortlisted', count(*) filter (where status = 'shortlisted'),
        'approved',    count(*) filter (where status = 'approved'),
        'declined',    count(*) filter (where status = 'declined'),
        'waitlisted',  count(*) filter (where status = 'waitlisted'),
        'last_7_days', count(*) filter (where submitted_at > now() - interval '7 days'),
        'prev_7_days', count(*) filter (where submitted_at > now() - interval '14 days'
                                          and submitted_at <= now() - interval '7 days'),
        'avg_score',   coalesce(round(avg(score), 1), 0)
      ) from public.applications
    ),
    'puppies', (
      select jsonb_build_object(
        'total',     count(*),
        'available', count(*) filter (where status = 'available'),
        'pending',   count(*) filter (where status = 'pending'),
        'placed',    count(*) filter (where status = 'placed')
      ) from public.puppies
    ),
    'messages', (
      select jsonb_build_object(
        'open_conversations', count(*) filter (where status = 'open'),
        'unread',             coalesce(sum(unread_for_admin), 0),
        'awaiting_reply',     count(*) filter (where unread_for_admin > 0)
      ) from public.conversations
    ),
    'waitlist', (
      select jsonb_build_object(
        'total',  count(*),
        'active', count(*) filter (where status = 'active')
      ) from public.waitlist
    ),
    'guides', (
      select jsonb_build_object(
        'total',     count(*),
        'published', count(*) filter (where is_published)
      ) from public.guides
    ),
    'applications_by_day', (
      select coalesce(jsonb_agg(d order by d ->> 'date'), '[]'::jsonb) from (
        select jsonb_build_object(
                 'date',  to_char(day, 'YYYY-MM-DD'),
                 'count', (select count(*) from public.applications a
                            where a.submitted_at >= day and a.submitted_at < day + interval '1 day')
               ) as d
          from generate_series(current_date - interval '29 days', current_date, interval '1 day') as day
      ) s
    ),
    'top_puppies', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select coalesce(puppy_name, 'No preference') as name, count(*) as count
          from public.applications
         group by 1 order by 2 desc limit 5
      ) t
    )
  ) into result;

  return result;
end;
$fn$;

grant execute on function public.admin_dashboard_stats() to authenticated;

-- ---------------------------------------------------------------------
-- Public site statistics - safe aggregate counts for the marketing pages
-- ---------------------------------------------------------------------
create or replace function public.public_site_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
  select jsonb_build_object(
    'available_puppies', (select count(*) from public.puppies where status = 'available' and is_published),
    'placed_puppies',    (select count(*) from public.puppies where status = 'placed' and is_published),
    'guides',            (select count(*) from public.guides where is_published)
  );
$fn$;

grant execute on function public.public_site_stats() to anon, authenticated;
