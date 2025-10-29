-- Migration cleanup: remove old note translation trigger and function
-- This trigger is now replaced by a Supabase Function Hook (translate-note)

drop trigger if exists translate_note_trigger on inspection_results;
drop function if exists handle_note_translation();
drop extension if exists http cascade;

-- The new Function Hook will handle note translation automatically.
