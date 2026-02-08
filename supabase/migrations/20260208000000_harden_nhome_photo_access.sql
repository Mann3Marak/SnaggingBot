-- Security hardening:
-- 1) Replace permissive nhome_photos authenticated policies
-- 2) Restrict append_photo_url() execution to service_role only

-- Remove permissive policies from initial table migration.
drop policy if exists "Authenticated users can insert photos" on public.nhome_photos;
drop policy if exists "Authenticated users can view photos" on public.nhome_photos;

-- Ensure we can safely re-run this migration.
drop policy if exists "Authenticated users can view own-company photos" on public.nhome_photos;
drop policy if exists "Authenticated users can insert own-company photos" on public.nhome_photos;

-- Read access is limited to:
-- - session owner (inspector)
-- - admins/managers in the same company as the session's project
create policy "Authenticated users can view own-company photos"
on public.nhome_photos
for select
to authenticated
using (
  exists (
    select 1
    from inspection_sessions s
    join apartments a on a.id = s.apartment_id
    join projects p on p.id = a.project_id
    join users u on u.id = auth.uid()
    where s.id = nhome_photos.session_id
      and (
        s.inspector_id = auth.uid()
        or (u.role in ('admin', 'manager') and p.company_id = u.company_id)
      )
  )
);

-- Insert access follows the same scope restriction.
create policy "Authenticated users can insert own-company photos"
on public.nhome_photos
for insert
to authenticated
with check (
  exists (
    select 1
    from inspection_sessions s
    join apartments a on a.id = s.apartment_id
    join projects p on p.id = a.project_id
    join users u on u.id = auth.uid()
    where s.id = nhome_photos.session_id
      and (
        s.inspector_id = auth.uid()
        or (u.role in ('admin', 'manager') and p.company_id = u.company_id)
      )
  )
);

-- Restrict SECURITY DEFINER function execution.
revoke execute on function public.append_photo_url(uuid, text) from anon;
revoke execute on function public.append_photo_url(uuid, text) from authenticated;
grant execute on function public.append_photo_url(uuid, text) to service_role;

notify pgrst, 'reload schema';
