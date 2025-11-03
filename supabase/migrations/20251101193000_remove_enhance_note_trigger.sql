-- Migration: Remove trigger and function that use net.http_post

-- Drop the trigger that calls the enhance-note Edge Function
drop trigger if exists on_note_change_enhance on public.inspection_results;

-- Drop the trigger function that uses net.http_post
drop function if exists public.trigger_enhance_note();

-- Optional: Drop the http extension if you no longer need it anywhere else
-- (Only do this if no other functions depend on it)
-- drop extension if exists http;

-- Refresh schema cache
notify pgrst, 'reload schema';
