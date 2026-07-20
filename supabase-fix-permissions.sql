-- Run this if setup.sql ran but you get "permission denied for table attendance_records"
-- (Error code 42501 in Supabase or on the setup page)
create table if not exists public.employee_profiles (
  emp_code text primary key,
  photo_data text default '',
  updated_at timestamptz default now()
);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.attendance_records to anon, authenticated;
grant select, insert, update, delete on public.employee_profiles to anon, authenticated;

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

select 'permissions fixed' as status;
