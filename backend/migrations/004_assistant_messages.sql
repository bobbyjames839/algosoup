-- Run in the Supabase SQL editor. Safe to re-run.
-- Each doctor has one continuous AI assistant conversation; the last few messages are sent to the model as context.

create table if not exists assistant_messages (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctors(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  reasoning text,
  steps jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index if not exists assistant_messages_doctor_time_idx on assistant_messages (doctor_id, created_at desc);

alter table assistant_messages enable row level security;
