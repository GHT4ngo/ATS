-- A record of every permanent erasure, and the lookups the daily retention
-- job uses.
--
-- Erasing a candidate deletes the log entries about them as well, so on its
-- own nothing would show that the erasure happened. erasure_log keeps that
-- fact, with no personal data: what kind of row, why, who and when.

create table public.erasure_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entity text not null check (entity in ('candidate', 'job')),
  -- request: a person asked for it. removed: removed long enough ago.
  -- retention: no activity for the retention period.
  reason text not null check (reason in ('request', 'removed', 'retention')),
  erased_by uuid references public.profiles (id) on delete set null,
  erased_at timestamptz not null default now()
);

create index erasure_log_organization_idx on public.erasure_log (organization_id, erased_at desc);
create index erasure_log_erased_by_idx on public.erasure_log (erased_by);

alter table public.erasure_log enable row level security;

create policy "erasure_log: read organization" on public.erasure_log
  for select to authenticated
  using ((select public.is_admin()) or organization_id = (select public.current_org_id()));

-- Written only by the erase functions below.
revoke all on public.erasure_log from anon;
revoke insert, update, delete, truncate on public.erasure_log from authenticated;

-- Erase and purge, now with the actor and the reason ------------------------

drop function public.erase_candidate(uuid);
drop function public.purge_job(uuid);

create function public.erase_candidate(p_id uuid, p_actor uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  delete from public.activity_log
  where (entity = 'candidate' and entity_id = p_id)
     or (entity = 'application' and entity_id in
          (select id from public.applications where candidate_id = p_id));
  delete from public.candidates where id = p_id returning organization_id into v_org;
  if v_org is null then
    return false;
  end if;
  insert into public.erasure_log (organization_id, entity, reason, erased_by)
  values (v_org, 'candidate', p_reason, p_actor);
  return true;
end;
$$;

create function public.purge_job(p_id uuid, p_actor uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  delete from public.activity_log
  where (entity = 'job' and entity_id = p_id)
     or (entity = 'application' and entity_id in
          (select id from public.applications where job_id = p_id));
  delete from public.jobs where id = p_id returning organization_id into v_org;
  if v_org is null then
    return false;
  end if;
  insert into public.erasure_log (organization_id, entity, reason, erased_by)
  values (v_org, 'job', p_reason, p_actor);
  return true;
end;
$$;

-- Retention lookups -----------------------------------------------------------
-- Candidates to erase: removed more than p_removed_days ago, or untouched for
-- p_retention_months. Untouched means no change to the candidate, to any of
-- their applications and no new CV assessment.

create function public.expired_candidates(p_removed_days int, p_retention_months int)
returns table (id uuid, organization_id uuid, reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.organization_id,
    case when c.removed_at is not null then 'removed' else 'retention' end
  from public.candidates c
  where (c.removed_at is not null
         and c.removed_at < now() - make_interval(days => p_removed_days))
     or (c.removed_at is null
         and greatest(
               c.updated_at,
               (select max(a.updated_at) from public.applications a where a.candidate_id = c.id),
               (select max(s.created_at) from public.cv_assessments s where s.candidate_id = c.id)
             ) < now() - make_interval(months => p_retention_months));
$$;

create function public.expired_jobs(p_removed_days int)
returns table (id uuid, organization_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select j.id, j.organization_id
  from public.jobs j
  where j.removed_at is not null
    and j.removed_at < now() - make_interval(days => p_removed_days);
$$;

revoke all on function public.erase_candidate(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.purge_job(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.expired_candidates(int, int) from public, anon, authenticated;
revoke all on function public.expired_jobs(int) from public, anon, authenticated;
grant execute on function public.erase_candidate(uuid, uuid, text) to service_role;
grant execute on function public.purge_job(uuid, uuid, text) to service_role;
grant execute on function public.expired_candidates(int, int) to service_role;
grant execute on function public.expired_jobs(int) to service_role;
