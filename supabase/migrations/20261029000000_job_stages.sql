-- Custom pipeline stages per job. Every stage belongs to one of the fixed
-- phases (the application_stage enum), so the all jobs board, the dashboard
-- funnel and the assistant keep a common scale. applications.stage stays as
-- the phase and is kept in sync from applications.stage_id by a trigger.

create table public.job_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid not null,
  -- null means a default stage, shown with the phase name in the UI language
  name text check (name is null or char_length(trim(name)) between 1 and 60),
  phase public.application_stage not null,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  unique (id, job_id),
  foreign key (job_id, organization_id)
    references public.jobs (id, organization_id) on delete cascade
);

create index job_stages_job_idx on public.job_stages (job_id, phase, position);
create index job_stages_organization_idx on public.job_stages (organization_id);

alter table public.job_stages enable row level security;

create policy "job_stages: organization access" on public.job_stages
  for all to authenticated
  using ((select public.is_admin()) or organization_id = (select public.current_org_id()))
  with check ((select public.is_admin()) or organization_id = (select public.current_org_id()));

revoke all on public.job_stages from anon;

-- Backfill: one default stage per phase for every job, and point every
-- application at its phase's stage. This runs before the triggers below
-- change, so days in stage (stage_changed_at) is preserved.
insert into public.job_stages (organization_id, job_id, phase, position)
select j.organization_id, j.id, p.phase, p.ord
from public.jobs j
cross join unnest(enum_range(null::public.application_stage)) with ordinality as p (phase, ord);

alter table public.applications add column stage_id uuid;

update public.applications a
set stage_id = s.id
from public.job_stages s
where s.job_id = a.job_id and s.phase = a.stage;

alter table public.applications
  alter column stage_id set not null,
  add constraint applications_stage_in_job
    -- NO ACTION, not RESTRICT: the check runs at the end of the statement, so
    -- deleting a job or organization (which cascades to both tables) always
    -- works, while deleting a stage that is still in use is refused.
    foreign key (stage_id, job_id) references public.job_stages (id, job_id) on delete no action;

create index applications_stage_id_idx on public.applications (stage_id);

-- New jobs start with one default stage per phase.
create function public.create_default_job_stages()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.job_stages (organization_id, job_id, phase, position)
  select new.organization_id, new.id, p.phase, p.ord
  from unnest(enum_range(null::public.application_stage)) with ordinality as p (phase, ord);
  return new;
end;
$$;

create trigger jobs_create_default_stages after insert on public.jobs
  for each row execute function public.create_default_job_stages();

-- Keep applications.stage (the phase) and stage_id consistent. Setting
-- stage_id wins; setting only the phase picks that phase's first stage.
create function public.sync_application_stage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stage_id is not null
     and (tg_op = 'INSERT' or new.stage_id is distinct from old.stage_id) then
    select s.phase into new.stage
    from public.job_stages s
    where s.id = new.stage_id and s.job_id = new.job_id;
  elsif tg_op = 'INSERT' or new.stage is distinct from old.stage then
    select s.id into new.stage_id
    from public.job_stages s
    where s.job_id = new.job_id and s.phase = new.stage
    order by s.position
    limit 1;
  end if;
  return new;
end;
$$;

create trigger applications_sync_stage before insert or update on public.applications
  for each row execute function public.sync_application_stage();

-- Days in stage also restart when a card moves between two stages of the
-- same phase.
create or replace function public.set_stage_changed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and (new.stage is distinct from old.stage or new.stage_id is distinct from old.stage_id) then
    new.stage_changed_at = now();
  elsif auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.stage_changed_at = now();
      new.created_at = now();
    else
      new.stage_changed_at = old.stage_changed_at;
    end if;
  end if;
  return new;
end;
$$;

-- A stage keeps its job and phase, and the last stage of a phase cannot be
-- removed (the all jobs board needs one per phase).
create function public.guard_job_stage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.phase is distinct from old.phase
       or new.job_id is distinct from old.job_id
       or new.organization_id is distinct from old.organization_id then
      raise exception 'A stage cannot change its job or phase' using errcode = 'check_violation';
    end if;
    return new;
  end if;
  if exists (select 1 from public.jobs where id = old.job_id)
     and not exists (
       select 1 from public.job_stages
       where job_id = old.job_id and phase = old.phase and id <> old.id
     ) then
    raise exception 'The last stage of a phase cannot be deleted' using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

create trigger job_stages_guard before update or delete on public.job_stages
  for each row execute function public.guard_job_stage();

-- Moves a stage one step up or down among the stages of its phase, in one
-- statement so two clicks cannot leave equal positions. Runs as the caller,
-- so RLS decides which stages can be reordered.
create function public.reorder_job_stage(p_stage uuid, p_direction text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  ids uuid[];
  i int;
begin
  if p_direction not in ('up', 'down') then
    raise exception 'direction must be up or down' using errcode = 'invalid_parameter_value';
  end if;
  select array_agg(s.id order by s.position, s.id) into ids
  from public.job_stages s
  join public.job_stages me on me.id = p_stage
  where s.job_id = me.job_id and s.phase = me.phase;
  i := array_position(ids, p_stage);
  if i is null then
    raise exception 'stage not found' using errcode = 'no_data_found';
  end if;
  if (p_direction = 'up' and i = 1) or (p_direction = 'down' and i = cardinality(ids)) then
    return;
  end if;
  ids[i] := ids[i + case p_direction when 'up' then -1 else 1 end];
  ids[i + case p_direction when 'up' then -1 else 1 end] := p_stage;
  -- Renumber the phase in its new order; positions stay distinct.
  update public.job_stages s
  set position = o.ord
  from unnest(ids) with ordinality as o (id, ord)
  where s.id = o.id and s.position is distinct from o.ord;
end;
$$;

revoke execute on function public.reorder_job_stage(uuid, text) from public, anon;
grant execute on function public.reorder_job_stage(uuid, text) to authenticated;
