-- Remediation hardening:
-- 1) Ensure append_photo_url() is not executable by PUBLIC/anon/authenticated.
-- 2) Resolve inspection_results.photo_urls type drift safely.
-- 3) Scope nhome_photos storage admin/manager access to same company only.

-- 1) Lock down SECURITY DEFINER function execution surface.
revoke execute on function public.append_photo_url(uuid, text) from public;
revoke execute on function public.append_photo_url(uuid, text) from anon;
revoke execute on function public.append_photo_url(uuid, text) from authenticated;
grant execute on function public.append_photo_url(uuid, text) to service_role;
alter function public.append_photo_url(uuid, text) set search_path = public;

-- 2) Safely normalize inspection_results.photo_urls to jsonb.
do $$
declare
  v_col_type text;
begin
  select format_type(a.atttypid, a.atttypmod)
    into v_col_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'inspection_results'
    and a.attname = 'photo_urls'
    and a.attnum > 0
    and not a.attisdropped;

  if v_col_type is null then
    alter table public.inspection_results
      add column photo_urls jsonb default '[]'::jsonb;
  elsif v_col_type = 'text[]' then
    alter table public.inspection_results
      alter column photo_urls type jsonb
      using coalesce(to_jsonb(photo_urls), '[]'::jsonb);
    alter table public.inspection_results
      alter column photo_urls set default '[]'::jsonb;
  elsif v_col_type = 'jsonb' then
    alter table public.inspection_results
      alter column photo_urls set default '[]'::jsonb;
  else
    raise warning 'inspection_results.photo_urls has unexpected type: %, migration skipped conversion', v_col_type;
  end if;
end
$$;

-- Keep trigger sync compatible with either historical text[] or normalized jsonb.
create or replace function public.sync_photo_urls_on_photo_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session_id uuid;
  target_item_id uuid;
  v_col_type text;
begin
  if tg_op = 'DELETE' then
    target_session_id := old.session_id;
    target_item_id := old.item_id;
  else
    target_session_id := new.session_id;
    target_item_id := new.item_id;
  end if;

  select format_type(a.atttypid, a.atttypmod)
    into v_col_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'inspection_results'
    and a.attname = 'photo_urls'
    and a.attnum > 0
    and not a.attisdropped;

  if v_col_type = 'jsonb' then
    execute $sql$
      update public.inspection_results
      set photo_urls = coalesce(
        (
          select jsonb_agg(p.supabase_url order by p.created_at)
          from public.nhome_photos p
          where p.session_id = $1
            and p.item_id = $2
        ),
        '[]'::jsonb
      )
      where session_id = $1
        and item_id = $2
    $sql$
    using target_session_id, target_item_id;
  elsif v_col_type = 'text[]' then
    execute $sql$
      update public.inspection_results
      set photo_urls = (
        select array_agg(p.supabase_url order by p.created_at)
        from public.nhome_photos p
        where p.session_id = $1
          and p.item_id = $2
      )
      where session_id = $1
        and item_id = $2
    $sql$
    using target_session_id, target_item_id;
  else
    raise warning 'sync_photo_urls_on_photo_change skipped; unsupported inspection_results.photo_urls type: %', v_col_type;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Helper used by storage.objects policies.
create or replace function public.nhome_is_company_admin_for_photo_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_session_id_text text;
begin
  v_prefix := split_part(object_name, '/', 1);
  v_session_id_text := split_part(object_name, '/', 2);

  if v_prefix <> 'sessions' then
    return false;
  end if;

  if v_session_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;

  return exists (
    select 1
    from public.users u
    join public.inspection_sessions s on s.id = v_session_id_text::uuid
    join public.apartments a on a.id = s.apartment_id
    join public.projects p on p.id = a.project_id
    where u.id = auth.uid()
      and u.role in ('admin', 'manager')
      and p.company_id = u.company_id
  );
end;
$$;

revoke execute on function public.nhome_is_company_admin_for_photo_object(text) from public;
grant execute on function public.nhome_is_company_admin_for_photo_object(text) to authenticated, service_role;

-- 3) Replace broad admin/manager storage policies with company-scoped checks.
drop policy if exists "NHome photos read" on storage.objects;
create policy "NHome photos read"
on storage.objects
for select
using (
  bucket_id = 'nhome_photos'
  and (
    owner = auth.uid()
    or public.nhome_is_company_admin_for_photo_object(name)
  )
);

drop policy if exists "NHome photos modify" on storage.objects;
create policy "NHome photos modify"
on storage.objects
for update
using (
  bucket_id = 'nhome_photos'
  and (
    owner = auth.uid()
    or public.nhome_is_company_admin_for_photo_object(name)
  )
)
with check (
  bucket_id = 'nhome_photos'
  and (
    owner = auth.uid()
    or public.nhome_is_company_admin_for_photo_object(name)
  )
);

drop policy if exists "NHome photos remove" on storage.objects;
create policy "NHome photos remove"
on storage.objects
for delete
using (
  bucket_id = 'nhome_photos'
  and (
    owner = auth.uid()
    or public.nhome_is_company_admin_for_photo_object(name)
  )
);

notify pgrst, 'reload schema';
