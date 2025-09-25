-- NHome multi-tenant base schema
create extension if not exists "pgcrypto";

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  founder text default 'Natalie O''Kelly',
  location text default 'Algarve, Portugal',
  website text default 'https://www.nhomesetup.com',
  created_at timestamp with time zone default timezone('utc', now())
);

create or replace function nhome_default_company()
returns uuid
language sql
stable
as $$
  select id from companies order by created_at limit 1;
$$;

create table if not exists users (
  id uuid primary key references auth.users on delete cascade,
  email text unique not null,
  role text check (role in ('admin', 'inspector', 'manager')) default 'inspector',
  company_id uuid references companies(id) default nhome_default_company(),
  full_name text,
  phone text,
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  developer_name text not null,
  developer_contact_email text,
  developer_contact_phone text,
  address text not null,
  project_type text default 'residential',
  company_id uuid references companies(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists apartments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  unit_number text not null,
  apartment_type text check (apartment_type in ('T2', 'T2+1', 'T3', 'T3+1')) not null,
  floor_number integer,
  total_area decimal(8,2),
  status text default 'pending',
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists checklist_templates (
  id uuid primary key default gen_random_uuid(),
  apartment_type text not null,
  room_type text not null,
  item_description text not null,
  item_description_pt text,
  order_sequence integer not null,
  nhome_standard_notes text,
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists inspection_sessions (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid references apartments(id) on delete cascade,
  inspector_id uuid references users(id) on delete set null,
  status text default 'in_progress',
  started_at timestamp with time zone default timezone('utc', now()),
  completed_at timestamp with time zone,
  current_item_index integer default 0,
  nhome_quality_score integer check (nhome_quality_score >= 1 and nhome_quality_score <= 10),
  client_satisfaction_notes text
);

create table if not exists inspection_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references inspection_sessions(id) on delete cascade,
  item_id uuid references checklist_templates(id) on delete cascade,
  status text check (status in ('good', 'issue', 'critical')) not null,
  notes text,
  enhanced_notes text,
  photo_urls text[],
  priority_level integer default 1 check (priority_level >= 1 and priority_level <= 3),
  estimated_cost decimal(10,2),
  created_at timestamp with time zone default timezone('utc', now())
);

create index if not exists idx_users_company on users(company_id);
create index if not exists idx_projects_company on projects(company_id);
create index if not exists idx_projects_created_by on projects(created_by);
create index if not exists idx_apartments_project on apartments(project_id);
create index if not exists idx_inspection_sessions_apartment on inspection_sessions(apartment_id);
create index if not exists idx_inspection_sessions_inspector on inspection_sessions(inspector_id);
create index if not exists idx_inspection_results_session on inspection_results(session_id);
create index if not exists idx_inspection_results_item on inspection_results(item_id);
create unique index if not exists uq_projects_company_name on projects (company_id, lower(name));
create unique index if not exists uq_apartments_project_unit on apartments (project_id, lower(unit_number));
create unique index if not exists uq_checklist_template_key on checklist_templates (apartment_type, room_type, order_sequence);

-- enable row level security
alter table if exists companies enable row level security;
alter table if exists users enable row level security;
alter table if exists projects enable row level security;
alter table if exists apartments enable row level security;
alter table if exists checklist_templates enable row level security;
alter table if exists inspection_sessions enable row level security;
alter table if exists inspection_results enable row level security;

-- policies
create policy "company self access" on companies
  for select
  using (id in (
    select company_id from users where id = auth.uid()
  ));

create policy "company membership management" on users
  for all
  using (company_id in (
    select company_id from users where id = auth.uid()
  ))
  with check (company_id in (
    select company_id from users where id = auth.uid()
  ));

create policy "NHome team can access company data" on projects
  for all
  using (company_id in (
    select company_id from users where id = auth.uid()
  ))
  with check (company_id in (
    select company_id from users where id = auth.uid()
  ));

create policy "NHome team apartments" on apartments
  for all
  using (project_id in (
    select id from projects where company_id in (
      select company_id from users where id = auth.uid()
    )
  ))
  with check (project_id in (
    select id from projects where company_id in (
      select company_id from users where id = auth.uid()
    )
  ));

create policy "checklist templates visibility" on checklist_templates
  for select
  using (true);

create policy "NHome inspectors can access their sessions" on inspection_sessions
  for all
  using (
    inspector_id = auth.uid()
    or exists (
      select 1 from users where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    inspector_id = auth.uid()
    or exists (
      select 1 from users where id = auth.uid() and role = 'admin'
    )
  );

create policy "NHome inspectors results" on inspection_results
  for all
  using (
    session_id in (
      select id from inspection_sessions where inspector_id = auth.uid()
        or exists (
          select 1 from users where id = auth.uid() and role = 'admin'
        )
    )
  )
  with check (
    session_id in (
      select id from inspection_sessions where inspector_id = auth.uid()
        or exists (
          select 1 from users where id = auth.uid() and role = 'admin'
        )
    )
  );

insert into companies (name, founder, location, website)
values (
  'NHome Property Setup & Management',
  'Natalie O''Kelly',
  'Algarve, Portugal',
  'https://www.nhomesetup.com'
)
on conflict (name) do update set
  founder = excluded.founder,
  location = excluded.location,
  website = excluded.website;




