-- Run in the Supabase SQL editor. Safe to re-run.
-- Lets patients sign in to the patient portal with their email + password.

alter table patients
  add column if not exists password_hash text;
