-- Migration: Automatically sync new auth.users into public.users

-- Function to handle new user creation
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, role, full_name)
  values (
    new.id,
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::text, 'user'),
    coalesce((new.raw_user_meta_data->>'full_name')::text, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call the function after a new user is created in auth.users
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Optional: ensure admins can access all users, others only their own
alter table public.users enable row level security;

create policy "Admins can access all users"
on public.users
for select
using (auth.uid() = id or role = 'admin');

create policy "Users can update their own profile"
on public.users
for update
using (auth.uid() = id);

-- Refresh schema cache
notify pgrst, 'reload schema';
