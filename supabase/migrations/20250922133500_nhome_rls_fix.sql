-- RLS recursion fix: use SECURITY DEFINER helpers and simplify users policy
set search_path = public;

create or replace function nhome_company_id_for_current_user()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from users where id = auth.uid() limit 1;
$$;

create or replace function nhome_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from users where id = auth.uid() and role = 'admin');
$$;

-- projects
drop policy if exists "NHome team can access company data" on projects;
create policy "NHome team can access company data" on projects
  for all
  using (company_id = nhome_company_id_for_current_user())
  with check (company_id = nhome_company_id_for_current_user());

-- apartments
drop policy if exists "NHome team apartments" on apartments;
create policy "NHome team apartments" on apartments
  for all
  using (project_id in (
    select id from projects where company_id = nhome_company_id_for_current_user()
  ))
  with check (project_id in (
    select id from projects where company_id = nhome_company_id_for_current_user()
  ));

-- companies
drop policy if exists "company self access" on companies;
create policy "company self access" on companies
  for select
  using (id = nhome_company_id_for_current_user());

-- inspection_sessions
drop policy if exists "NHome inspectors can access their sessions" on inspection_sessions;
create policy "NHome inspectors can access their sessions" on inspection_sessions
  for all
  using (inspector_id = auth.uid() or nhome_is_admin())
  with check (inspector_id = auth.uid() or nhome_is_admin());

-- inspection_results
drop policy if exists "NHome inspectors results" on inspection_results;
create policy "NHome inspectors results" on inspection_results
  for all
  using (session_id in (
    select id from inspection_sessions where inspector_id = auth.uid() or nhome_is_admin()
  ))
  with check (session_id in (
    select id from inspection_sessions where inspector_id = auth.uid() or nhome_is_admin()
  ));

-- users: remove recursive policy, allow self-read only
drop policy if exists "company membership management" on users;
create policy "users read self" on users
  for select
  using (id = auth.uid());
