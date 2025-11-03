-- Migration: Add trigger to call enhance-note Edge Function when notes are inserted or updated

create or replace function public.trigger_enhance_note()
returns trigger as $$
declare
  payload jsonb;
begin
  payload := jsonb_build_object(
    'record', row_to_json(NEW)
  );

  perform net.http_post(
    current_setting('app.settings.edge_function_url', true) || '/enhance-note',
    payload::text,
    jsonb_build_object('Content-Type', 'application/json')
  );

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_note_change_enhance on public.inspection_results;

create trigger on_note_change_enhance
after insert or update of notes
on public.inspection_results
for each row
when (NEW.notes is not null and NEW.notes <> '')
execute function public.trigger_enhance_note();

-- Refresh schema cache
notify pgrst, 'reload schema';
