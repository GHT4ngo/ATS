-- Core schema for the mini ATS: organizations, profiles, jobs, candidates,
-- applications and the activity log, with row level security on every table.
--
-- Access model:
--   * admin: internal staff, full access to every organization.
--   * customer: full access, but only within their own organization.
--   * A deactivated profile (is_active = false) gets no access at all.

-- Types -----------------------------------------------------------------------

create type public.user_role as enum ('admin', 'customer');
create type public.job_status as enum ('open', 'paused', 'closed');
create type public.employment_type as enum ('full_time', 'part_time', 'contract', 'internship');
create type public.application_stage as enum (
  'applied', 'screening', 'interview', 'offer', 'hired', 'rejected'
);

-- Shared trigger functions ----------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Tables ----------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 200),
  role public.user_role not null default 'customer',
  organization_id uuid references public.organizations (id) on delete restrict,
  locale text not null default 'sv' check (locale in ('sv', 'en')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Customers always belong to an organization; admins may have none.
  constraint customer_has_organization check (role = 'admin' or organization_id is not null)
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 20000),
  location text not null default '' check (char_length(location) <= 200),
  employment_type public.employment_type not null default 'full_time',
  status public.job_status not null default 'open',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Target for the composite foreign key on applications.
  unique (id, organization_id)
);

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 200),
  email text check (email is null or char_length(email) <= 320),
  phone text check (phone is null or char_length(phone) <= 50),
  linkedin_url text check (linkedin_url is null or char_length(linkedin_url) <= 500),
  location text check (location is null or char_length(location) <= 200),
  notes text not null default '' check (char_length(notes) <= 20000),
  cv_path text check (cv_path is null or char_length(cv_path) <= 500),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

-- One candidate per email address within an organization.
create unique index candidates_org_email_key
  on public.candidates (organization_id, lower(email))
  where email is not null;

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  candidate_id uuid not null,
  job_id uuid not null,
  stage public.application_stage not null default 'applied',
  -- Order within a kanban column; fractional so a move updates a single row.
  position double precision not null default 0,
  rating smallint check (rating between 1 and 5),
  stage_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, job_id),
  -- Composite keys guarantee that the candidate and the job belong to the
  -- same organization as the application.
  foreign key (candidate_id, organization_id)
    references public.candidates (id, organization_id) on delete cascade,
  foreign key (job_id, organization_id)
    references public.jobs (id, organization_id) on delete cascade
);

create table public.activity_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  entity text not null check (entity in ('job', 'candidate', 'application')),
  entity_id uuid not null,
  action text not null check (char_length(action) between 1 and 100),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes ---------------------------------------------------------------------

create index profiles_organization_id_idx on public.profiles (organization_id);
create index jobs_organization_id_idx on public.jobs (organization_id);
create index candidates_organization_id_idx on public.candidates (organization_id);
create index applications_organization_stage_idx
  on public.applications (organization_id, stage, position);
create index applications_job_id_idx on public.applications (job_id, organization_id);
create index applications_candidate_id_idx on public.applications (candidate_id, organization_id);
create index activity_log_entity_idx on public.activity_log (entity, entity_id, created_at desc);
create index activity_log_organization_idx on public.activity_log (organization_id, created_at desc);
create index activity_log_actor_id_idx on public.activity_log (actor_id);
create index jobs_created_by_idx on public.jobs (created_by);
create index candidates_created_by_idx on public.candidates (created_by);

-- updated_at triggers ---------------------------------------------------------

create trigger organizations_set_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger jobs_set_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();
create trigger candidates_set_updated_at before update on public.candidates
  for each row execute function public.set_updated_at();
create trigger applications_set_updated_at before update on public.applications
  for each row execute function public.set_updated_at();

create function public.set_stage_changed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stage is distinct from old.stage then
    new.stage_changed_at = now();
  end if;
  return new;
end;
$$;

create trigger applications_set_stage_changed_at before update on public.applications
  for each row execute function public.set_stage_changed_at();

-- Access helpers --------------------------------------------------------------
-- Security definer so policies can read profiles without recursing into the
-- profiles policies. Both return false or null for deactivated users.

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

create function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organization_id from public.profiles
  where id = auth.uid() and is_active;
$$;

-- True when the current user may act within the given organization.
create function public.can_access_org(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or org = public.current_org_id();
$$;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.current_org_id() from public, anon;
revoke execute on function public.can_access_org(uuid) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_org_id() to authenticated;
grant execute on function public.can_access_org(uuid) to authenticated;

-- Profiles: created from auth.users ------------------------------------------
-- Role and organization come from app_metadata, which only the service role
-- can set (auth.admin.createUser). user_metadata is user controlled and is
-- used for the display name only.
--
-- GoTrue inserts the user first and writes app_metadata in a later update, so
-- the profile is created the first time app_metadata carries a role. A user
-- without one gets no profile and therefore no access. Later changes to role
-- or organization are made on the profile, which is the source of truth.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_app_meta_data ? 'role' then
    insert into public.profiles (id, full_name, role, organization_id, locale)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'full_name', ''),
      (new.raw_app_meta_data ->> 'role')::public.user_role,
      (new.raw_app_meta_data ->> 'organization_id')::uuid,
      coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'sv')
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created after insert or update of raw_app_meta_data on auth.users
  for each row execute function public.handle_new_user();

-- Only admins (or the service role, where auth.uid() is null) may change who
-- a user is: role, organization and active flag.
create function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_admin() and (
    new.role is distinct from old.role
    or new.organization_id is distinct from old.organization_id
    or new.is_active is distinct from old.is_active
  ) then
    raise exception 'Only admins can change role, organization or active status'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_fields before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- Row level security ----------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.candidates enable row level security;
alter table public.applications enable row level security;
alter table public.activity_log enable row level security;

-- Nothing is reachable without logging in.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- organizations: members read their own, admins manage all.
create policy "organizations: read own or admin" on public.organizations
  for select to authenticated
  using ((select public.can_access_org(id)));
create policy "organizations: admin insert" on public.organizations
  for insert to authenticated
  with check ((select public.is_admin()));
create policy "organizations: admin update" on public.organizations
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "organizations: admin delete" on public.organizations
  for delete to authenticated
  using ((select public.is_admin()));

-- profiles: read yourself and your team; update yourself (guarded by the
-- trigger above); admins manage all. Inserts happen through the auth trigger.
create policy "profiles: read self, team or admin" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.can_access_org(organization_id))
  );
create policy "profiles: update self or admin" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles: admin delete" on public.profiles
  for delete to authenticated
  using ((select public.is_admin()));

-- jobs, candidates, applications: full access within your organization.
create policy "jobs: organization access" on public.jobs
  for all to authenticated
  using ((select public.can_access_org(organization_id)))
  with check ((select public.can_access_org(organization_id)));

create policy "candidates: organization access" on public.candidates
  for all to authenticated
  using ((select public.can_access_org(organization_id)))
  with check ((select public.can_access_org(organization_id)));

create policy "applications: organization access" on public.applications
  for all to authenticated
  using ((select public.can_access_org(organization_id)))
  with check ((select public.can_access_org(organization_id)));

-- activity_log: append only. Entries are written under your own identity.
create policy "activity_log: read organization" on public.activity_log
  for select to authenticated
  using ((select public.can_access_org(organization_id)));
create policy "activity_log: insert as self" on public.activity_log
  for insert to authenticated
  with check (
    actor_id = (select auth.uid())
    and (select public.can_access_org(organization_id))
  );

revoke update, delete, truncate on public.activity_log from authenticated;

-- Storage: private CV bucket --------------------------------------------------
-- Object paths are "<organization_id>/<candidate_id>/<file name>".

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cvs', 'cvs', false, 10485760, array['application/pdf']);

create policy "cvs: organization read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'cvs'
    and (
      (select public.is_admin())
      or (storage.foldername(name))[1] = (select public.current_org_id())::text
    )
  );
create policy "cvs: organization insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cvs'
    and (
      (select public.is_admin())
      or (storage.foldername(name))[1] = (select public.current_org_id())::text
    )
  );
create policy "cvs: organization update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'cvs'
    and (
      (select public.is_admin())
      or (storage.foldername(name))[1] = (select public.current_org_id())::text
    )
  )
  with check (
    bucket_id = 'cvs'
    and (
      (select public.is_admin())
      or (storage.foldername(name))[1] = (select public.current_org_id())::text
    )
  );
create policy "cvs: organization delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'cvs'
    and (
      (select public.is_admin())
      or (storage.foldername(name))[1] = (select public.current_org_id())::text
    )
  );
