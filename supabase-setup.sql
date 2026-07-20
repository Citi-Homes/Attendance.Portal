-- Safe setup — run ALL of this in Supabase SQL Editor → Run
-- If you already ran part of the old script, this still works.

create table if not exists public.attendance_records (
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
  record_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_attendance_emp_code on public.attendance_records (emp_code);
create index if not exists idx_attendance_punch_in on public.attendance_records (punch_in);
create index if not exists idx_attendance_record_date on public.attendance_records (record_date);

create table if not exists public.employee_profiles (
  emp_code text primary key,
  photo_data text default '',
  updated_at timestamptz default now()
);

alter table public.attendance_records enable row level security;
alter table public.employee_profiles enable row level security;

drop policy if exists "Allow anon read attendance" on public.attendance_records;
drop policy if exists "Allow anon insert attendance" on public.attendance_records;
drop policy if exists "Allow anon update attendance" on public.attendance_records;
drop policy if exists "Allow anon delete attendance" on public.attendance_records;
drop policy if exists "Allow anon read employee profiles" on public.employee_profiles;
drop policy if exists "Allow anon insert employee profiles" on public.employee_profiles;
drop policy if exists "Allow anon update employee profiles" on public.employee_profiles;
drop policy if exists "Allow anon delete employee profiles" on public.employee_profiles;

create policy "Allow anon read attendance"
  on public.attendance_records for select to anon using (true);

create policy "Allow anon insert attendance"
  on public.attendance_records for insert to anon with check (true);

create policy "Allow anon update attendance"
  on public.attendance_records for update to anon using (true) with check (true);

create policy "Allow anon delete attendance"
  on public.attendance_records for delete to anon using (true);

create policy "Allow anon read employee profiles"
  on public.employee_profiles for select to anon using (true);

create policy "Allow anon insert employee profiles"
  on public.employee_profiles for insert to anon with check (true);

create policy "Allow anon update employee profiles"
  on public.employee_profiles for update to anon using (true) with check (true);

create policy "Allow anon delete employee profiles"
  on public.employee_profiles for delete to anon using (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.attendance_records to anon, authenticated;
grant select, insert, update, delete on public.employee_profiles to anon, authenticated;

-- Confirm table exists (you should see one row in Results)
select 'attendance_records ready' as status, count(*) as row_count from public.attendance_records;
select 'employee_profiles ready' as status, count(*) as row_count from public.employee_profiles;
