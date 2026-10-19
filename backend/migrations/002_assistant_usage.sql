-- Run in the Supabase SQL editor. Safe to re-run.
-- One row per AI assistant question; used to rate-limit and cap token spend.

create table if not exists assistant_usage (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid references doctors(id) on delete set null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists assistant_usage_time_idx on assistant_usage (created_at);
create index if not exists assistant_usage_doctor_time_idx on assistant_usage (doctor_id, created_at);

alter table assistant_usage enable row level security;
