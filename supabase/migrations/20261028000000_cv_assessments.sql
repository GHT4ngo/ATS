-- AI CV assessments: decision support for one candidate against one job.
-- Rows are written only by the server (service role) after it has checked
-- access as the signed in user, so a score cannot be forged through the API.
-- Every run is kept; the app shows the latest per candidate and job.

create table public.cv_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  candidate_id uuid not null,
  job_id uuid not null,
  score smallint not null check (score between 0 and 100),
  summary text not null check (char_length(summary) <= 4000),
  strengths jsonb not null default '[]'::jsonb check (jsonb_typeof(strengths) = 'array'),
  gaps jsonb not null default '[]'::jsonb check (jsonb_typeof(gaps) = 'array'),
  skill_matches jsonb not null default '[]'::jsonb check (jsonb_typeof(skill_matches) = 'array'),
  interview_questions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(interview_questions) = 'array'),
  model text not null check (char_length(model) <= 100),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (candidate_id, organization_id)
    references public.candidates (id, organization_id) on delete cascade,
  foreign key (job_id, organization_id)
    references public.jobs (id, organization_id) on delete cascade
);

create index cv_assessments_lookup_idx
  on public.cv_assessments (organization_id, candidate_id, job_id, created_at desc);
create index cv_assessments_job_idx on public.cv_assessments (job_id, organization_id);
create index cv_assessments_created_by_idx on public.cv_assessments (created_by);

alter table public.cv_assessments enable row level security;

create policy "cv_assessments: read organization" on public.cv_assessments
  for select to authenticated
  using ((select public.is_admin()) or organization_id = (select public.current_org_id()));

revoke all on public.cv_assessments from anon;
revoke insert, update, delete, truncate on public.cv_assessments from authenticated;
