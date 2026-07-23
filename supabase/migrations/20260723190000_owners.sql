-- NHome owners / clients module. An owner exists once and can own many apartments.
create extension if not exists "pgcrypto";

create table if not exists owners (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade default nhome_default_company(),
  first_name text,
  surname text,
  tax_number text not null,
  email text,
  phone text,
  address text,
  nationality text,
  preferred_language text,
  secondary_contact_name text,
  secondary_contact_phone text,
  notes text,
  created_by uuid references users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc', now()),
  updated_at timestamp with time zone default timezone('utc', now())
);

-- Tax number is mandatory and unique within a company.
create unique index if not exists uq_owners_company_tax on owners (company_id, lower(tax_number));
create index if not exists idx_owners_company on owners(company_id);

-- Link apartments to an owner (nullable; existing client_name/surname columns kept
-- for backward compatibility).
alter table if exists apartments
  add column if not exists owner_id uuid references owners(id) on delete set null;
create index if not exists idx_apartments_owner on apartments(owner_id);

-- updated_at trigger (helper created by the bookings migration; recreate defensively).
create or replace function nhome_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_owners_updated_at on owners;
create trigger trg_owners_updated_at
  before update on owners
  for each row execute function nhome_set_updated_at();

alter table if exists owners enable row level security;

drop policy if exists "NHome team owners" on owners;
create policy "NHome team owners" on owners
  for all
  using (company_id in (
    select company_id from users where id = auth.uid()
  ))
  with check (company_id in (
    select company_id from users where id = auth.uid()
  ));
