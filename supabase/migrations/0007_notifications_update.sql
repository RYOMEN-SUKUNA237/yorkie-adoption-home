-- =====================================================================
-- 0007_notifications_update.sql
-- Add notification preferences and WhatsApp details to applications table
-- =====================================================================

alter table public.applications
  add column if not exists notification_preference text not null default 'email',
  add column if not exists applicant_whatsapp text;

-- Replace submit_application to process notification_preference and applicant_whatsapp
create or replace function public.submit_application(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  created public.applications;
  pet_count integer;
begin
  -- --- Required fields -------------------------------------------------
  if coalesce(trim(payload ->> 'first_name'), '') = ''
     or coalesce(trim(payload ->> 'last_name'), '') = ''
     or coalesce(trim(payload ->> 'email'), '') = ''
     or coalesce(trim(payload ->> 'phone'), '') = ''
     or coalesce(trim(payload ->> 'city'), '') = ''
     or coalesce(trim(payload ->> 'country'), '') = '' then
    raise exception 'Missing required contact details'
      using errcode = 'check_violation';
  end if;

  -- --- The three commitments are non-negotiable ------------------------
  if not coalesce((payload ->> 'will_return')::boolean, false)
     or not coalesce((payload ->> 'will_spay_neuter')::boolean, false)
     or not coalesce((payload ->> 'understands_decline')::boolean, false) then
    raise exception 'All three commitments must be accepted'
      using errcode = 'check_violation';
  end if;

  pet_count := coalesce(jsonb_array_length(
    case when jsonb_typeof(payload -> 'pets') = 'array' then payload -> 'pets' else '[]'::jsonb end
  ), 0);

  if pet_count > 20 then
    raise exception 'Too many pets listed' using errcode = 'check_violation';
  end if;

  if length(coalesce(payload ->> 'additional_info', '')) > 5000
     or length(coalesce(payload ->> 'previous_dog_history', '')) > 5000
     or length(coalesce(payload ->> 'travel_care', '')) > 5000
     or length(coalesce(payload ->> 'dog_sleeps', '')) > 5000 then
    raise exception 'A written answer exceeds the 5000 character limit'
      using errcode = 'check_violation';
  end if;

  -- --- Insert ----------------------------------------------------------
  insert into public.applications (
    first_name, last_name, email, phone, city, country,
    ownership, landlord_allows, home_type, fenced_space,
    adult_count, children_ages, allergies, primary_carer,
    has_pets, pets,
    hours_alone, dog_sleeps, travel_care,
    owned_before, previous_dog_history,
    will_return, will_spay_neuter, understands_decline, additional_info,
    puppy_id, puppy_slug, puppy_name,
    notification_preference, applicant_whatsapp,
    status, reviewed_at, reviewed_by
  ) values (
    trim(payload ->> 'first_name'),
    trim(payload ->> 'last_name'),
    lower(trim(payload ->> 'email')),
    trim(payload ->> 'phone'),
    trim(payload ->> 'city'),
    trim(payload ->> 'country'),

    nullif(payload ->> 'ownership', ''),
    nullif(payload ->> 'landlord_allows', ''),
    nullif(payload ->> 'home_type', ''),
    nullif(payload ->> 'fenced_space', ''),

    greatest(0, least(50, coalesce((payload ->> 'adult_count')::integer, 1))),
    nullif(payload ->> 'children_ages', ''),
    nullif(payload ->> 'allergies', ''),
    nullif(payload ->> 'primary_carer', ''),

    (payload ->> 'has_pets')::boolean,
    case when jsonb_typeof(payload -> 'pets') = 'array' then payload -> 'pets' else '[]'::jsonb end,

    greatest(0, least(24, coalesce((payload ->> 'hours_alone')::integer, 0))),
    nullif(payload ->> 'dog_sleeps', ''),
    nullif(payload ->> 'travel_care', ''),

    (payload ->> 'owned_before')::boolean,
    nullif(payload ->> 'previous_dog_history', ''),

    true, true, true,
    nullif(payload ->> 'additional_info', ''),

    (select p.id from public.puppies p where p.id = nullif(payload ->> 'puppy_id', '')::uuid),
    (select p.slug from public.puppies p where p.id = nullif(payload ->> 'puppy_id', '')::uuid),
    (select p.name from public.puppies p where p.id = nullif(payload ->> 'puppy_id', '')::uuid),

    coalesce(nullif(payload ->> 'notification_preference', ''), 'email'),
    nullif(payload ->> 'applicant_whatsapp', ''),

    'pending', null, null
  )
  returning * into created;

  return jsonb_build_object(
    'id', created.id,
    'reference', created.reference,
    'score', created.score
  );
end;
$fn$;

comment on function public.submit_application(jsonb) is
  'Public submission entry point with notification preference support.';

revoke all on function public.submit_application(jsonb) from public;
grant execute on function public.submit_application(jsonb) to anon, authenticated;
