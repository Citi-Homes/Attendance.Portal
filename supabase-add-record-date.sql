-- Run once in Supabase SQL Editor if attendance_records already exists without record_date.
-- Enables reliable month filters and full-month reports.

alter table public.attendance_records
  add column if not exists record_date date;

create index if not exists idx_attendance_record_date
  on public.attendance_records (record_date);

-- Backfill from punch_in text (ISO prefix or "DD Mon YYYY" format)
update public.attendance_records
set record_date = coalesce(
  nullif(substring(punch_in from '^\d{4}-\d{2}-\d{2}'), '')::date,
  to_date(
    regexp_replace(
      substring(punch_in from '\d{1,2}\s+\w{3}\s+\d{4}'),
      '^(\d{1,2})\s+(\w{3})\s+(\d{4})$',
      '\1 \2 \3'
    ),
    'DD Mon YYYY'
  ),
  current_date
)
where record_date is null;

select 'record_date column ready' as status, count(*) as rows from public.attendance_records;
