-- Run in the Supabase SQL editor. Safe to re-run.
-- Adds hospitals, doctor hospital/specialty, and records where each appointment took place,
-- so a patient's history can include appointments with doctors at other hospitals.

create table if not exists hospitals (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  city text,
  created_at timestamptz not null default now()
);
alter table hospitals enable row level security;

alter table doctors
  add column if not exists hospital_id uuid references hospitals(id) on delete set null,
  add column if not exists specialty text;

-- Snapshot of where the appointment happened (a doctor may later move hospital).
alter table appointments
  add column if not exists hospital_id uuid references hospitals(id) on delete set null;

create index if not exists appointments_doctor_time_idx on appointments (doctor_id, scheduled_at);
