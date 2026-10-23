-- The newest assessment per candidate and job. security_invoker makes the
-- view run with the caller's rights, so the cv_assessments RLS still applies.
create view public.latest_cv_assessments
with (security_invoker = true) as
select distinct on (organization_id, candidate_id, job_id) *
from public.cv_assessments
order by organization_id, candidate_id, job_id, created_at desc;

revoke all on public.latest_cv_assessments from anon;
grant select on public.latest_cv_assessments to authenticated;

-- One running assessment per candidate and job. The server claims the row
-- (service role) before calling Claude and deletes it afterwards; a claim
-- older than the stale window is taken over, so a crashed run cannot block.
create table public.cv_assessment_locks (
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  locked_at timestamptz not null default now(),
  primary key (candidate_id, job_id)
);

create index cv_assessment_locks_job_idx on public.cv_assessment_locks (job_id);

-- No policies: only the service role, which bypasses RLS, can use the table.
alter table public.cv_assessment_locks enable row level security;
revoke all on public.cv_assessment_locks from anon, authenticated;

create function public.claim_cv_assessment(p_candidate uuid, p_job uuid, p_stale_seconds int)
returns boolean
language sql
set search_path = ''
as $$
  insert into public.cv_assessment_locks as l (candidate_id, job_id)
  values (p_candidate, p_job)
  on conflict (candidate_id, job_id) do update set locked_at = now()
    where l.locked_at < now() - make_interval(secs => p_stale_seconds)
  returning true;
$$;

revoke execute on function public.claim_cv_assessment(uuid, uuid, int)
  from public, anon, authenticated;
