-- Recruiter marks on an application: a star for a candidate who stands out, a
-- flag for one that needs attention, and a manual verdict on the requirements.
-- mismatch is null while the AI score decides (below 40 counts as not meeting
-- the requirements); true or false is the recruiter's own call and wins.
-- The existing "applications: organization access" policy covers the columns.

alter table public.applications
  add column starred boolean not null default false,
  add column flagged boolean not null default false,
  add column mismatch boolean;

-- The activity log trigger stamped every entry with now(), including the
-- backdated history the server side seed writes, so every demo event showed the
-- seed time. Users still cannot backdate an entry; only the service role can.
create or replace function public.check_activity_entity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  found boolean := false;
begin
  if new.entity = 'job' then
    select exists (select 1 from public.jobs j
      where j.id = new.entity_id and j.organization_id = new.organization_id) into found;
  elsif new.entity = 'candidate' then
    select exists (select 1 from public.candidates c
      where c.id = new.entity_id and c.organization_id = new.organization_id) into found;
  elsif new.entity = 'application' then
    select exists (select 1 from public.applications a
      where a.id = new.entity_id and a.organization_id = new.organization_id) into found;
  end if;
  if not found then
    raise exception 'Activity entity % % not found in organization', new.entity, new.entity_id
      using errcode = '23503';
  end if;
  if auth.uid() is not null then
    new.created_at = now();
  end if;
  return new;
end;
$$;
