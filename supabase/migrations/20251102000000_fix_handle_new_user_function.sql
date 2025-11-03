-- Migration: Correct handle_new_user trigger function (remove invalid set_config)

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

-- Ensure RLS allows inserts from this trigger
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Allow inserts from trigger' and tablename = 'users'
  ) then
    create policy "Allow inserts from trigger"
    on public.users
    for insert
    with check (true);
  end if;
end $$;

-- Refresh schema cache
notify pgrst, 'reload schema';
