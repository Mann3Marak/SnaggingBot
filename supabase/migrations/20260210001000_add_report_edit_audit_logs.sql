-- Audit trail for admin-initiated report edits.
create table if not exists public.report_edit_audit_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.inspection_sessions(id) on delete cascade,
  result_id uuid not null references public.inspection_results(id) on delete cascade,
  edited_by uuid references public.users(id) on delete set null,
  field_name text not null check (field_name in ('status', 'enhanced_notes')),
  old_value text,
  new_value text,
  change_reason text not null,
  batch_id uuid not null,
  edited_at timestamp with time zone not null default timezone('utc', now())
);

create index if not exists idx_report_edit_audit_logs_session on public.report_edit_audit_logs(session_id, edited_at desc);
create index if not exists idx_report_edit_audit_logs_result on public.report_edit_audit_logs(result_id, edited_at desc);
create index if not exists idx_report_edit_audit_logs_batch on public.report_edit_audit_logs(batch_id);

alter table public.report_edit_audit_logs enable row level security;

-- Company-scoped read access for admins/managers.
drop policy if exists "Company admins can view report edit audit logs" on public.report_edit_audit_logs;
create policy "Company admins can view report edit audit logs"
on public.report_edit_audit_logs
for select
using (
  exists (
    select 1
    from public.inspection_sessions s
    join public.apartments a on a.id = s.apartment_id
    join public.projects p on p.id = a.project_id
    join public.users u on u.id = auth.uid()
    where s.id = report_edit_audit_logs.session_id
      and p.company_id = u.company_id
      and u.role in ('admin', 'manager')
  )
);

-- Admins can insert logs for sessions in their company.
drop policy if exists "Company admins can insert report edit audit logs" on public.report_edit_audit_logs;
create policy "Company admins can insert report edit audit logs"
on public.report_edit_audit_logs
for insert
with check (
  exists (
    select 1
    from public.inspection_sessions s
    join public.apartments a on a.id = s.apartment_id
    join public.projects p on p.id = a.project_id
    join public.users u on u.id = auth.uid()
    where s.id = report_edit_audit_logs.session_id
      and p.company_id = u.company_id
      and u.role = 'admin'
  )
);
