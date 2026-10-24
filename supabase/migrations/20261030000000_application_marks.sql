-- Recruiter marks on an application: a star for a candidate who stands out, a
-- flag for one that needs attention, and a manual verdict on the requirements.
-- mismatch is null while the AI score decides (below 40 counts as not meeting
-- the requirements); true or false is the recruiter's own call and wins.
-- The existing "applications: organization access" policy covers the columns.

alter table public.applications
  add column starred boolean not null default false,
  add column flagged boolean not null default false,
  add column mismatch boolean;
