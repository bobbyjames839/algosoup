-- Run in the Supabase SQL editor. Safe to re-run.
-- Adds descriptive/scheduling detail to appointments and clinical narrative to appointment_data.

alter table appointments
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists duration_minutes int not null default 30,
  add column if not exists location text,
  add column if not exists cancellation_reason text,
  add column if not exists updated_at timestamptz not null default now();

alter table appointments drop constraint if exists appointments_duration_minutes_check;
alter table appointments add constraint appointments_duration_minutes_check check (duration_minutes between 5 and 480);

alter table appointment_data
  add column if not exists chief_complaint text,
  add column if not exists assessment text,
  add column if not exists plan text,
  add column if not exists insulin_regimen text,
  add column if not exists follow_up_weeks int check (follow_up_weeks between 0 and 104),
  add column if not exists updated_at timestamptz not null default now();
