-- NHome bookings / calendar module (standalone, soft-linked to apartments)
create extension if not exists "pgcrypto";

-- Generic updated_at trigger helper
create or replace function nhome_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- A stay/booking. Soft-linked to an apartment (nullable) so bookings can exist
-- independently, and scoped directly by company_id for RLS regardless of apartment.
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade default nhome_default_company(),
  apartment_id uuid references apartments(id) on delete set null,
  guest_name text,
  arrival_date date,
  departure_date date,
  budget numeric(10,2),
  notes text,
  status text not null default 'confirmed'
    check (status in ('tentative', 'confirmed', 'cancelled', 'completed')),
  outlook_event_id text,
  outlook_synced_at timestamp with time zone,
  created_by uuid references users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc', now()),
  updated_at timestamp with time zone default timezone('utc', now())
);

-- Typed events that hang off a booking. Deliveries / cleanings / inspections can
-- each occur zero-to-many times. arrival/departure are allowed too for flexibility
-- and Outlook mapping, but the primary stay dates live on the booking row.
create table if not exists booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  event_type text not null
    check (event_type in ('arrival', 'departure', 'delivery', 'cleaning', 'inspection')),
  event_date date not null,
  event_time time,
  title text,
  notes text,
  outlook_event_id text,
  outlook_synced_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc', now()),
  updated_at timestamp with time zone default timezone('utc', now())
);

-- Append-only audit log for booking history (requirement #4).
create table if not exists booking_audit (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete set null,
  action text not null,
  actor_id uuid references users(id) on delete set null,
  actor_email text,
  changes jsonb,
  created_at timestamp with time zone default timezone('utc', now())
);

create index if not exists idx_bookings_company on bookings(company_id);
create index if not exists idx_bookings_apartment on bookings(apartment_id);
create index if not exists idx_bookings_arrival on bookings(arrival_date);
create index if not exists idx_bookings_departure on bookings(departure_date);
create index if not exists idx_booking_events_booking on booking_events(booking_id);
create index if not exists idx_booking_events_date on booking_events(event_date);
create index if not exists idx_booking_events_outlook on booking_events(outlook_event_id);
create index if not exists idx_bookings_outlook on bookings(outlook_event_id);
create index if not exists idx_booking_audit_booking on booking_audit(booking_id);

drop trigger if exists trg_bookings_updated_at on bookings;
create trigger trg_bookings_updated_at
  before update on bookings
  for each row execute function nhome_set_updated_at();

drop trigger if exists trg_booking_events_updated_at on booking_events;
create trigger trg_booking_events_updated_at
  before update on booking_events
  for each row execute function nhome_set_updated_at();

-- Row level security (mirrors the company-membership pattern used elsewhere).
alter table if exists bookings enable row level security;
alter table if exists booking_events enable row level security;
alter table if exists booking_audit enable row level security;

drop policy if exists "NHome team bookings" on bookings;
create policy "NHome team bookings" on bookings
  for all
  using (company_id in (
    select company_id from users where id = auth.uid()
  ))
  with check (company_id in (
    select company_id from users where id = auth.uid()
  ));

drop policy if exists "NHome team booking events" on booking_events;
create policy "NHome team booking events" on booking_events
  for all
  using (booking_id in (
    select id from bookings where company_id in (
      select company_id from users where id = auth.uid()
    )
  ))
  with check (booking_id in (
    select id from bookings where company_id in (
      select company_id from users where id = auth.uid()
    )
  ));

drop policy if exists "NHome team booking audit" on booking_audit;
create policy "NHome team booking audit" on booking_audit
  for select
  using (booking_id in (
    select id from bookings where company_id in (
      select company_id from users where id = auth.uid()
    )
  ));
