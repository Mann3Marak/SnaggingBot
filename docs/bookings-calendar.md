# Bookings & Calendar module

A standalone bookings/calendar feature layered onto the existing NHome app. Bookings
are soft-linked to apartments (nullable `apartment_id`) so they can exist independently
while still powering the per-apartment and all-apartments calendar views.

## What's included

| Requirement | Where |
| --- | --- |
| 1. Per-apartment calendar | `/calendar` → **Per apartment** tab (`MonthCalendar`) |
| 2. All-apartments overview | `/calendar` → **All apartments** tab (`OverviewTimeline`) |
| 3. Booking input (arrival, departure, deliveries, cleanings, inspections, budget, notes) | `BookingForm` |
| 4. History of all data | `booking_audit` table + **History** tab (`HistoryView`) |
| 5. Weekly & monthly reporting | **Reports** tab (`ReportsView`) |
| 6. Outlook two-way sync | `sync-outlook`, `outlook/webhook`, `outlook/subscribe` routes |

## Data model (`supabase/migrations/20260723120000_bookings.sql`)

- **`bookings`** — one stay: `apartment_id?`, `guest_name`, `arrival_date`, `departure_date`,
  `budget`, `notes`, `status` (`tentative`/`confirmed`/`cancelled`/`completed`),
  `outlook_event_id?`. Scoped by `company_id` for RLS.
- **`booking_events`** — typed events (`delivery`/`cleaning`/`inspection`, plus
  `arrival`/`departure` for flexibility): `event_date`, `event_time?`, `notes`,
  `outlook_event_id?`. One row ↔ one Outlook event.
- **`booking_audit`** — append-only history, written by the API on every create/update/delete/sync.

RLS mirrors the existing company-membership policies. Server API routes use the
service-role key (like the rest of the app) and attribute the signed-in user via the
Supabase session cookie for audit entries.

### Apply the migration

```bash
npm run db:migrate   # supabase db push --linked
```

## API routes (`src/app/api/nhome/bookings/*`)

- `POST /bookings` — create (booking + events + audit)
- `GET  /bookings/list?apartmentId=&from=&to=` — list with events + apartment hydrated
- `GET  /bookings/get?id=` — single booking + full audit
- `POST /bookings/update` — update fields, replace events, audit before/after diff
- `POST /bookings/delete` — delete (events cascade), audit snapshot
- `GET  /bookings/history?bookingId=&limit=` — audit feed
- `POST /bookings/sync-outlook` — outbound push to Outlook (6a)
- `POST /bookings/outlook/subscribe` — create/renew Graph change subscription (6b)
- `ANY  /bookings/outlook/webhook` — Graph notification receiver (6b)
- `GET  /apartments/all` — every apartment (picker + overview rows)

## Outlook two-way sync setup (Sprint 6)

Reuses the existing Microsoft Graph **application** token
(`src/lib/server/nhome-graph-auth.ts`). Because that token is app-level (not a
signed-in user), events are written to a designated shared mailbox/calendar.

1. In Azure AD, grant the app **`Calendars.ReadWrite`** *application* permission and
   admin-consent it (the app already has `Files.ReadWrite` for OneDrive uploads).
2. Add env vars:

   ```
   NHOME_OUTLOOK_USER=bookings@yourdomain.com      # target mailbox UPN or object id (required)
   NHOME_OUTLOOK_CALENDAR_ID=                       # optional specific calendar id
   NHOME_OUTLOOK_TIMEZONE=GMT Standard Time         # optional (Windows tz name)
   NHOME_OUTLOOK_WEBHOOK_URL=https://<public-host>/api/nhome/bookings/outlook/webhook
   NHOME_OUTLOOK_CLIENT_STATE=<random-secret>       # validates inbound notifications
   ```

3. **Outbound (app → Outlook):** click *Sync to Outlook* on a booking, or `POST /bookings/sync-outlook`.
   Stores the returned Graph event ids on the booking/events.
4. **Inbound (Outlook → app):** `POST /bookings/outlook/subscribe` once you have a public
   HTTPS URL. Graph calendar subscriptions expire in ~3 days — re-run on a schedule
   (cron/scheduled agent) to renew. The webhook matches changed events back by stored
   `outlook_event_id` and reconciles date/time (last-write-wins).

> Inbound sync needs a public HTTPS endpoint, so it can't be exercised from localhost —
> the handler is complete and idempotent, ready once deployed.

If `NHOME_OUTLOOK_USER` is unset, sync endpoints return a clear 400 and the rest of the
module works normally.
