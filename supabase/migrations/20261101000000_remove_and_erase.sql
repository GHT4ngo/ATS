-- Removed candidates and jobs, and permanent erasure.
--
-- Remove is a soft delete: the row stays, with removed_at set, but RLS hides
-- it from everyone, admins included, together with the applications, stage
-- lists and CV assessments that hang off it. Admins list, restore and purge
-- removed rows through the service role, after the server has checked their
-- role. Erase deletes a candidate for good, with its log entries, so a GDPR
-- erasure request can be met at once.

alter table public.candidates
  add column removed_at timestamptz,
  add column removed_by uuid references public.profiles (id) on delete set null;

alter table public.jobs
  add column removed_at timestamptz,
  add column removed_by uuid references public.profiles (id) on delete set null;

create index candidates_removed_by_idx on public.candidates (removed_by);
create index jobs_removed_by_idx on public.jobs (removed_by);

-- A removed candidate no longer holds on to its email, so the same person
-- can be added again. Restoring then fails on the duplicate, which is right.
drop index public.candidates_org_email_key;
create unique index candidates_org_email_key
  on public.candidates (organization_id, lower(email))
  where email is not null and removed_at is null;

-- Policies --------------------------------------------------------------------
-- The "organization access" policies covered every command at once; they are
-- split so reads and writes see only rows that are not removed. removed_at can
-- only be set through remove_candidate and remove_job below.

drop policy "jobs: organization access" on public.jobs;
create policy "jobs: read organization" on public.jobs
  for select to authenticated
  using (removed_at is null
    and ((select public.is_admin()) or organization_id = (select public.current_org_id())));
create policy "jobs: insert organization" on public.jobs
  for insert to authenticated
  with check (removed_at is null
    and ((select public.is_admin()) or organization_id = (select public.current_org_id())));
create policy "jobs: update organization" on public.jobs
  for update to authenticated
  using (removed_at is null
    and ((select public.is_admin()) or organization_id = (select public.current_org_id())))
  with check (removed_at is null
    and ((select public.is_admin()) or organization_id = (select public.current_org_id())));
create policy "jobs: delete organization" on public.jobs
  for delete to authenticated
  using (removed_at is null
    and ((select public.is_admin()) or organization_id = (select public.current_org_id())));

drop policy "candidates: organization access" on public.candidates;
create policy "candidates: read organization" on public.candidates
  for select to authenticated
  using (removed_at is null
    and ((select public.is_admin()) or organization_id = (select public.current_org_id())));
create policy "candidates: insert organization" on public.candidates
  for insert to authenticated
  with check (removed_at is null
    and ((select public.is_admin()) or organization_id = (select public.current_org_id())));
create policy "candidates: update organization" on public.candidates
  for update to authenticated
  using (removed_at is null
    and ((select public.is_admin()) or organization_id = (select public.current_org_id())))
  with check (removed_at is null
    and ((select public.is_admin()) or organization_id = (select public.current_org_id())));
create policy "candidates: delete organization" on public.candidates
  for delete to authenticated
  using (removed_at is null
    and ((select public.is_admin()) or organization_id = (select public.current_org_id())));

-- An application is visible while both its candidate and its job are. The
-- subqueries run under the caller's RLS, which already hides removed rows.
drop policy "applications: organization access" on public.applications;
create policy "applications: organization access" on public.applications
  for all to authenticated
  using (
    ((select public.is_admin()) or organization_id = (select public.current_org_id()))
    and exists (select 1 from public.candidates c where c.id = candidate_id)
    and exists (select 1 from public.jobs j where j.id = job_id)
  )
  with check (
    ((select public.is_admin()) or organization_id = (select public.current_org_id()))
    and exists (select 1 from public.candidates c where c.id = candidate_id)
    and exists (select 1 from public.jobs j where j.id = job_id)
  );

drop policy "cv_assessments: read organization" on public.cv_assessments;
create policy "cv_assessments: read organization" on public.cv_assessments
  for select to authenticated
  using (
    ((select public.is_admin()) or organization_id = (select public.current_org_id()))
    and exists (select 1 from public.candidates c where c.id = candidate_id)
    and exists (select 1 from public.jobs j where j.id = job_id)
  );

drop policy "job_stages: organization access" on public.job_stages;
create policy "job_stages: organization access" on public.job_stages
  for all to authenticated
  using (
    ((select public.is_admin()) or organization_id = (select public.current_org_id()))
    and exists (select 1 from public.jobs j where j.id = job_id)
  )
  with check (
    ((select public.is_admin()) or organization_id = (select public.current_org_id()))
    and exists (select 1 from public.jobs j where j.id = job_id)
  );

-- Remove ----------------------------------------------------------------------
-- Anyone who can see the row may remove it. p_org is the organization the
-- app acts in, so an admin cannot remove a row of another organization by
-- mistake. True when a row was removed.

create function public.remove_candidate(p_id uuid, p_org uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.candidates
  set removed_at = now(), removed_by = auth.uid()
  where id = p_id
    and organization_id = p_org
    and removed_at is null
    and (public.is_admin() or p_org = public.current_org_id());
  return found;
end;
$$;

create function public.remove_job(p_id uuid, p_org uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.jobs
  set removed_at = now(), removed_by = auth.uid()
  where id = p_id
    and organization_id = p_org
    and removed_at is null
    and (public.is_admin() or p_org = public.current_org_id());
  return found;
end;
$$;

revoke all on function public.remove_candidate(uuid, uuid) from public, anon;
revoke all on function public.remove_job(uuid, uuid) from public, anon;
grant execute on function public.remove_candidate(uuid, uuid) to authenticated;
grant execute on function public.remove_job(uuid, uuid) to authenticated;

-- Activity and CV files of removed rows -------------------------------------
-- Log entries about a removed candidate, job or application carry names, so
-- they are hidden with the row. The subqueries run under the caller's RLS.

drop policy "activity_log: read organization" on public.activity_log;
create policy "activity_log: read organization" on public.activity_log
  for select to authenticated
  using (
    ((select public.is_admin()) or organization_id = (select public.current_org_id()))
    and case entity
      when 'candidate' then exists (select 1 from public.candidates c where c.id = entity_id)
      when 'job' then exists (select 1 from public.jobs j where j.id = entity_id)
      when 'application' then exists (select 1 from public.applications a where a.id = entity_id)
      else false
    end
  );

-- True when a CV path sits in the folder of a removed candidate. Security
-- definer, since RLS hides removed candidates from the caller.
create function public.cv_folder_removed(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.candidates c
    where c.id::text = (storage.foldername(p_name))[2]
      and c.removed_at is not null
  );
$$;

revoke all on function public.cv_folder_removed(text) from public, anon;
grant execute on function public.cv_folder_removed(text) to authenticated;

drop policy "cvs: organization read" on storage.objects;
drop policy "cvs: organization insert" on storage.objects;
drop policy "cvs: organization update" on storage.objects;
drop policy "cvs: organization delete" on storage.objects;

create policy "cvs: organization read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'cvs'
    and ((select public.is_admin())
      or (storage.foldername(name))[1] = (select public.current_org_id())::text)
    and not public.cv_folder_removed(name)
  );
create policy "cvs: organization insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cvs'
    and ((select public.is_admin())
      or (storage.foldername(name))[1] = (select public.current_org_id())::text)
    and not public.cv_folder_removed(name)
  );
create policy "cvs: organization update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'cvs'
    and ((select public.is_admin())
      or (storage.foldername(name))[1] = (select public.current_org_id())::text)
    and not public.cv_folder_removed(name)
  )
  with check (
    bucket_id = 'cvs'
    and ((select public.is_admin())
      or (storage.foldername(name))[1] = (select public.current_org_id())::text)
    and not public.cv_folder_removed(name)
  );
create policy "cvs: organization delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'cvs'
    and ((select public.is_admin())
      or (storage.foldername(name))[1] = (select public.current_org_id())::text)
    and not public.cv_folder_removed(name)
  );

-- Erase and purge -------------------------------------------------------------
-- Permanent: the row and everything under it go, in one transaction, with the
-- log entries about it, since those carry the candidate's name. The CV file is
-- deleted from storage by the server. Service role only: the server checks
-- who may erase what before it calls these.

create function public.erase_candidate(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.activity_log
  where (entity = 'candidate' and entity_id = p_id)
     or (entity = 'application' and entity_id in
          (select id from public.applications where candidate_id = p_id));
  delete from public.candidates where id = p_id;
  return found;
end;
$$;

create function public.purge_job(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.activity_log
  where (entity = 'job' and entity_id = p_id)
     or (entity = 'application' and entity_id in
          (select id from public.applications where job_id = p_id));
  delete from public.jobs where id = p_id;
  return found;
end;
$$;

revoke all on function public.erase_candidate(uuid) from public, anon, authenticated;
revoke all on function public.purge_job(uuid) from public, anon, authenticated;
grant execute on function public.erase_candidate(uuid) to service_role;
grant execute on function public.purge_job(uuid) to service_role;
