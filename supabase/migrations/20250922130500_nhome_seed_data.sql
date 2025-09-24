-- Seed data for NHome organisation
-- Ensure the default company row exists
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

-- Attach Supabase auth users to the NHome directory.
-- Run `insert into auth.users` or invite these users before seeding.
with nhome_company as (
  select id from companies where name = 'NHome Property Setup & Management'
),
admin_user as (
  select u.id, coalesce(u.email, 'natalie@nhomesetup.com') as email
  from auth.users u
  where u.email ilike 'natalie@nhomesetup.com'
)
insert into users (id, email, full_name, role, company_id)
select a.id, a.email, 'Natalie O''Kelly', 'admin', c.id
from admin_user a
cross join nhome_company c
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  company_id = excluded.company_id;

with nhome_company as (
  select id from companies where name = 'NHome Property Setup & Management'
),
inspector_user as (
  select u.id, coalesce(u.email, 'inspector@nhomesetup.com') as email
  from auth.users u
  where u.email ilike 'inspector@nhomesetup.com'
)
insert into users (id, email, full_name, role, company_id)
select i.id, i.email, 'Senior Inspector', 'inspector', c.id
from inspector_user i
cross join nhome_company c
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  company_id = excluded.company_id;

-- Seed a sample Algarve project
insert into projects (name, developer_name, developer_contact_email, developer_contact_phone, address, company_id)
select
  'Quinta do Lago Residences',
  'Algarve Development Ltd',
  'developer@algarvedev.pt',
  '+351 919 000 000',
  'Quinta do Lago, 8135-024 Almancil',
  c.id
from companies c
where c.name = 'NHome Property Setup & Management'
on conflict (company_id, lower(name)) do update set
  developer_name = excluded.developer_name,
  developer_contact_email = excluded.developer_contact_email,
  developer_contact_phone = excluded.developer_contact_phone,
  address = excluded.address;

-- Optional starter checklist templates for T3 apartments
insert into checklist_templates (apartment_type, room_type, item_description, item_description_pt, order_sequence, nhome_standard_notes)
values
  ('T3', 'Entrada', 'Verificar estado da porta principal e macanetas', 'Verificar estado da porta principal e macanetas', 1, 'Confirm door seals are intact and aligned'),
  ('T3', 'Sala de Estar', 'Testar iluminacao, tomadas e deteccao de humidade', 'Testar iluminacao, tomadas e deteccao de humidade', 2, 'Log humidity readings above 60% as follow-up'),
  ('T3', 'Cozinha', 'Inspecionar electrodomesticos integrados e armarios', 'Inspecionar electrodomesticos integrados e armarios', 3, 'Capture serial numbers for appliances')
on conflict (apartment_type, room_type, order_sequence) do nothing;
