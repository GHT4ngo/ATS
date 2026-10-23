-- Profiles carry a read only copy of the login email, so team and admin lists
-- do not need the service role to look it up in auth.users.
--
-- The copy is kept in sync by the auth trigger. Nobody can write it through the
-- API: update is granted per column from here on, and email is left out. New
-- profile columns that users may edit need an explicit grant.

alter table public.profiles add column email text;

update public.profiles p set email = u.email
from auth.users u where u.id = p.id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_app_meta_data ? 'role'
    and (tg_op = 'INSERT' or not coalesce(old.raw_app_meta_data ? 'role', false))
  then
    insert into public.profiles (id, email, full_name, role, organization_id, locale)
    values (
      new.id,
      new.email,
      left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 200),
      (new.raw_app_meta_data ->> 'role')::public.user_role,
      (new.raw_app_meta_data ->> 'organization_id')::uuid,
      case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'sv' end
    )
    on conflict (id) do nothing;
  elsif tg_op = 'UPDATE' and new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of raw_app_meta_data, email on auth.users
  for each row execute function public.handle_new_user();

revoke update on public.profiles from authenticated;
grant update (full_name, role, organization_id, locale, is_active)
  on public.profiles to authenticated;
