-- =====================================================================
-- Yorkshire Adoption Home - core schema
-- =====================================================================
-- Run order: 0001_schema -> 0002_functions -> 0003_rls -> 0004_storage
--            -> 0005_realtime -> then seed.sql (optional)
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type puppy_status as enum ('available', 'pending', 'placed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type puppy_sex as enum ('male', 'female');
exception when duplicate_object then null; end $$;

do $$ begin
  create type parent_role as enum ('sire', 'dam');
exception when duplicate_object then null; end $$;

do $$ begin
  create type application_status as enum ('pending', 'reviewing', 'shortlisted', 'approved', 'declined', 'waitlisted', 'withdrawn');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role as enum ('admin', 'staff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type conversation_status as enum ('open', 'snoozed', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sender_role as enum ('visitor', 'admin', 'system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type waitlist_status as enum ('active', 'contacted', 'converted', 'removed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- profiles - staff accounts, 1:1 with auth.users
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  role        user_role not null default 'staff',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Staff/admin accounts. A row here is what grants dashboard access; anonymous visitors never get one.';

-- ---------------------------------------------------------------------
-- parents - sires and dams, referenced by puppies
-- ---------------------------------------------------------------------
create table if not exists public.parents (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  role          parent_role not null,
  photo_url     text,
  health_tests  jsonb not null default '[]'::jsonb,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint parents_name_role_key unique (name, role)
);

comment on column public.parents.health_tests is
  'Array of { test: string, result: string }.';

-- ---------------------------------------------------------------------
-- puppies
-- ---------------------------------------------------------------------
create table if not exists public.puppies (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  sex               puppy_sex not null,
  date_of_birth     date not null,
  status            puppy_status not null default 'available',
  temperament_tags  text[] not null default '{}',
  temperament_notes text not null default '',
  photos            text[] not null default '{}',
  price             numeric(10, 2),
  currency          text not null default 'USD',
  sire_id           uuid references public.parents (id) on delete set null,
  dam_id            uuid references public.parents (id) on delete set null,
  display_order     integer not null default 0,
  is_published      boolean not null default true,
  placed_at         date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint puppies_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

-- Age is derived, never stored: a stored age_weeks goes stale every week.
create or replace function public.puppy_age_weeks(dob date)
returns integer language sql immutable as $fn$
  select greatest(0, (current_date - dob) / 7)::int;
$fn$;

create index if not exists puppies_status_idx        on public.puppies (status);
create index if not exists puppies_display_order_idx on public.puppies (display_order, created_at desc);
create index if not exists puppies_name_trgm_idx     on public.puppies using gin (name gin_trgm_ops);

-- ---------------------------------------------------------------------
-- puppy health records
-- ---------------------------------------------------------------------
create table if not exists public.puppy_vaccinations (
  id            uuid primary key default gen_random_uuid(),
  puppy_id      uuid not null references public.puppies (id) on delete cascade,
  name          text not null,
  administered  date,
  due           date,
  done          boolean not null default false,
  display_order integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists puppy_vaccinations_puppy_idx on public.puppy_vaccinations (puppy_id, display_order);

create table if not exists public.puppy_dewormings (
  id            uuid primary key default gen_random_uuid(),
  puppy_id      uuid not null references public.puppies (id) on delete cascade,
  product       text not null,
  administered  date not null,
  display_order integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists puppy_dewormings_puppy_idx on public.puppy_dewormings (puppy_id, display_order);

-- ---------------------------------------------------------------------
-- guides
-- ---------------------------------------------------------------------
create table if not exists public.guides (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            text not null,
  summary          text not null default '',
  cover_image      text,
  reading_time_min integer not null default 5,
  published_date   date not null default current_date,
  sections         jsonb not null default '[]'::jsonb,
  is_published     boolean not null default true,
  display_order    integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint guides_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

comment on column public.guides.sections is
  'Array of { heading?: string, body: string } rendered in order.';

create index if not exists guides_published_idx on public.guides (is_published, display_order, published_date desc);

-- ---------------------------------------------------------------------
-- applications
-- ---------------------------------------------------------------------
create sequence if not exists public.application_reference_seq start 1;

create table if not exists public.applications (
  id                   uuid primary key default gen_random_uuid(),
  reference            text not null unique,

  -- Step 1 - about you
  first_name           text not null,
  last_name            text not null,
  email                text not null,
  phone                text not null,
  city                 text not null,
  country              text not null,

  -- Step 2 - your home
  ownership            text,        -- own | rent
  landlord_allows      text,        -- yes | no | unsure
  home_type            text,        -- house | apartment | compound
  fenced_space         text,        -- yes | partial | no

  -- Step 3 - household
  adult_count          integer not null default 1,
  children_ages        text,
  allergies            text,
  primary_carer        text,

  -- Step 4 - other pets
  has_pets             boolean,
  pets                 jsonb not null default '[]'::jsonb,

  -- Step 5 - daily life
  hours_alone          integer not null default 0,
  dog_sleeps           text,
  travel_care          text,

  -- Step 6 - experience
  owned_before         boolean,
  previous_dog_history text,

  -- Step 7 - commitment
  will_return          boolean not null default false,
  will_spay_neuter     boolean not null default false,
  understands_decline  boolean not null default false,
  additional_info      text,

  -- Target + review
  puppy_id             uuid references public.puppies (id) on delete set null,
  puppy_slug           text,
  puppy_name           text,
  score                numeric(4, 1) not null default 0,
  score_breakdown      jsonb not null default '[]'::jsonb,
  status               application_status not null default 'pending',
  reviewed_at          timestamptz,
  reviewed_by          uuid references public.profiles (id) on delete set null,
  decision_note        text,

  submitted_at         timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint applications_email_format check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

comment on column public.applications.puppy_slug is
  'Denormalised so the record survives the puppy row being deleted.';

create index if not exists applications_status_idx    on public.applications (status, submitted_at desc);
create index if not exists applications_puppy_idx     on public.applications (puppy_id);
create index if not exists applications_submitted_idx on public.applications (submitted_at desc);
create index if not exists applications_email_idx     on public.applications (lower(email));
create index if not exists applications_search_idx    on public.applications
  using gin ((first_name || ' ' || last_name || ' ' || email || ' ' || city || ' ' || country) gin_trgm_ops);

-- ---------------------------------------------------------------------
-- application_notes - internal review timeline
-- ---------------------------------------------------------------------
create table if not exists public.application_notes (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  author_id      uuid references public.profiles (id) on delete set null,
  author_name    text,
  body           text not null,
  is_system      boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists application_notes_app_idx on public.application_notes (application_id, created_at desc);

-- ---------------------------------------------------------------------
-- waitlist
-- ---------------------------------------------------------------------
create table if not exists public.waitlist (
  id             uuid primary key default gen_random_uuid(),
  email          text not null,
  full_name      text,
  phone          text,
  country        text,
  note           text,
  source         text not null default 'website',
  application_id uuid references public.applications (id) on delete set null,
  status         waitlist_status not null default 'active',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint waitlist_email_unique unique (email),
  constraint waitlist_email_format check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

-- ---------------------------------------------------------------------
-- conversations + messages - the in-app messenger
-- ---------------------------------------------------------------------
create table if not exists public.conversations (
  id                   uuid primary key default gen_random_uuid(),
  visitor_id           uuid not null,   -- auth.uid() of the anonymous visitor
  visitor_name         text,
  visitor_email        text,
  subject              text,
  status               conversation_status not null default 'open',
  assigned_to          uuid references public.profiles (id) on delete set null,
  last_message_at      timestamptz not null default now(),
  last_message_preview text,
  unread_for_admin     integer not null default 0,
  unread_for_visitor   integer not null default 0,
  page_url             text,
  user_agent           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.conversations is
  'One thread per visitor. visitor_id is the anonymous auth user id, which is what RLS scopes on.';

create index if not exists conversations_visitor_idx on public.conversations (visitor_id);
create index if not exists conversations_status_idx  on public.conversations (status, last_message_at desc);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_role     sender_role not null,
  sender_id       uuid,
  sender_name     text,
  body            text not null default '',
  attachment_url  text,
  attachment_name text,
  read_at         timestamptz,
  created_at      timestamptz not null default now(),
  constraint messages_not_empty check (length(trim(body)) > 0 or attachment_url is not null)
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------------
-- site_settings - editable from the dashboard
-- ---------------------------------------------------------------------
create table if not exists public.site_settings (
  key         text primary key,
  value       jsonb not null,
  is_public   boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id) on delete set null
);

-- ---------------------------------------------------------------------
-- activity_log - audit trail for dashboard actions
-- ---------------------------------------------------------------------
create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_name  text,
  action      text not null,
  entity      text not null,
  entity_id   text,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists activity_log_created_idx on public.activity_log (created_at desc);
create index if not exists activity_log_entity_idx  on public.activity_log (entity, entity_id);
