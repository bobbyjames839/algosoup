-- Run in the Supabase SQL editor.
create extension if not exists "pgcrypto";

create table if not exists hospitals (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  city text,
  created_at timestamptz not null default now()
);

create table if not exists doctors (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  full_name text not null,
  hospital_id uuid references hospitals(id) on delete set null,
  specialty text,
  created_at timestamptz not null default now()
);

create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid references doctors(id) on delete set null,
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  email text,
  phone text,
  diagnosis_date date,
  -- Patient portal login (email + password). Null = no portal access.
  password_hash text,
  created_at timestamptz not null default now()
);

create table if not exists glucose_readings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  value_mmol numeric(4,1) not null,
  context text check (context in ('fasting','pre_meal','post_meal','bedtime','other')) default 'other',
  recorded_at timestamptz not null default now()
);
create index if not exists glucose_patient_time_idx on glucose_readings (patient_id, recorded_at desc);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  doctor_id uuid references doctors(id) on delete set null,
  -- Where the appointment took place (snapshot; a doctor may later move hospital).
  hospital_id uuid references hospitals(id) on delete set null,
  scheduled_at timestamptz not null,
  appointment_type text not null check (appointment_type in ('initial','routine','follow_up','urgent','telehealth')),
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  title text,
  description text,
  duration_minutes int not null default 30 check (duration_minutes between 5 and 480),
  location text,
  notes text,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists appointments_time_idx on appointments (scheduled_at);
create index if not exists appointments_doctor_time_idx on appointments (doctor_id, scheduled_at);

create table if not exists appointment_data (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid unique not null references appointments(id) on delete cascade,
  height_cm numeric(5,1),
  weight_kg numeric(5,1),
  hba1c_percent numeric(4,1),
  blood_pressure text,
  overall_score int check (overall_score between 0 and 100),
  chief_complaint text,
  assessment text,
  plan text,
  insulin_regimen text,
  follow_up_weeks int check (follow_up_weeks between 0 and 104),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  doctor_id uuid references doctors(id) on delete set null,
  sender text not null check (sender in ('patient','doctor')),
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_patient_time_idx on messages (patient_id, created_at);

create table if not exists assistant_usage (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid references doctors(id) on delete set null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists assistant_usage_time_idx on assistant_usage (created_at);
create index if not exists assistant_usage_doctor_time_idx on assistant_usage (doctor_id, created_at);

-- Lock tables down: only the backend (service role key) can access them.
alter table hospitals enable row level security;
alter table doctors enable row level security;
alter table patients enable row level security;
alter table glucose_readings enable row level security;
alter table appointments enable row level security;
alter table appointment_data enable row level security;
alter table messages enable row level security;
alter table assistant_usage enable row level security;
