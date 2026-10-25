-- Openings per job, archived cards and a code repository link per candidate.
-- The existing organization access policies on jobs, candidates and
-- applications cover the new columns.

-- How many people a job hires. A job with as many hires as openings counts as
-- filled; reopening it adds an opening.
alter table public.jobs
  add column openings smallint not null default 1 check (openings between 1 and 999);

-- GitHub, GitLab or another public code profile.
alter table public.candidates
  add column repo_url text check (repo_url is null or char_length(repo_url) <= 500);

-- A hired or rejected card the recruiter has cleared off the board. The
-- application stays for the history and the statistics. Rejected cards also
-- leave the board on their own after a week, which the app works out from
-- stage_changed_at, so nothing has to run on a schedule.
alter table public.applications
  add column archived_at timestamptz;

-- A card that changes stage comes back to the board, and days in stage
-- restart as before.
create or replace function public.set_stage_changed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and (new.stage is distinct from old.stage or new.stage_id is distinct from old.stage_id) then
    new.stage_changed_at = now();
    new.archived_at = null;
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
