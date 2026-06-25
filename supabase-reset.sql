-- ONLY use this if the normal supabase-setup.sql keeps failing
-- because the table was created incorrectly. This deletes all cloud attendance data.

drop table if exists public.attendance_records cascade;

create table public.attendance_records (
  id bigint primary key,
  emp_code text not null,
  emp_name text not null,
  designation text default '',
  department text default '',
  category text not null,
  punch_in text not null,
  punch_out text default '',
  remarks text default '',
  loc_in jsonb,
  loc_out jsonb,
  status text not null,
  extra jsonb default '{}'::jsonb,
  source text default 'portal',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_attendance_emp_code on public.attendance_records (emp_code);
create index idx_attendance_punch_in on public.attendance_records (punch_in);

alter table public.attendance_records enable row level security;

create policy "Allow anon read attendance"
  on public.attendance_records for select to anon using (true);

create policy "Allow anon insert attendance"
  on public.attendance_records for insert to anon with check (true);

create policy "Allow anon update attendance"
  on public.attendance_records for update to anon using (true) with check (true);

create policy "Allow anon delete attendance"
  on public.attendance_records for delete to anon using (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.attendance_records to anon, authenticated;

select 'attendance_records reset complete' as status;
