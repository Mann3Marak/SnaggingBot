-- Migration: Remove user sync trigger and function to prevent user creation errors

-- Drop the trigger if it exists
drop trigger if exists on_auth_user_created on auth.users;

-- Drop the function if it exists
drop function if exists public.handle_new_user;

-- Refresh schema cache
notify pgrst, 'reload schema';
