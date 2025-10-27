-- Migration: Add automatic translation trigger for inspection_results.notes updates
-- This migration creates a trigger that calls the Supabase Edge Function "translate-note"
-- whenever the "notes" field is inserted or updated.

-- 1. Create the trigger function
create or replace function handle_note_translation()
returns trigger as $$
begin
  -- Only trigger when notes change
  if new.notes is distinct from old.notes then
    -- Call the edge function asynchronously
    perform
        http_send(
          http_request(
            'POST'::text,
            'https://<YOUR_PROJECT_REF>.functions.supabase.co/translate-note'::text,
            jsonb_build_object('Content-Type', 'application/json'),
            jsonb_build_object(
              'resultId', new.id,
              'note', new.notes
            )::text
          )
        );
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- 2. Create the trigger
drop trigger if exists translate_note_trigger on inspection_results;

create trigger translate_note_trigger
after insert or update of notes
on inspection_results
for each row
execute function handle_note_translation();
