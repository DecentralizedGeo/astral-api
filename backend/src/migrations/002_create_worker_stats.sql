-- Supabase SQL schema for worker_stats table
create table if not exists public.worker_stats (
  id SERIAL primary key,
  updated_at TIMESTAMPTZ not null default now(),
  start_time TIMESTAMPTZ,
  last_successful_run TIMESTAMPTZ,
  last_run_duration DOUBLE PRECISION,
  total_runs INTEGER,
  successful_runs INTEGER,
  failed_runs INTEGER,
  total_attestations_ingested JSONB,
  last_run_attestations_ingested JSONB,
  errors JSONB,
  revocation_last_run TIMESTAMPTZ,
  revocation_checked_count INTEGER,
  revocation_revoked_count INTEGER,
  is_running BOOLEAN,
  is_revocation_check_running BOOLEAN
);

-- Enable Row Level Security (RLS)
alter table public.worker_stats ENABLE row LEVEL SECURITY;

-- Allow service role full access
create policy "Allow service role full access" on public.worker_stats using (auth.role () = 'service_role');

-- Optional: upsert helper function for a single-row stats table
-- (You may want to use a fixed id, e.g., id=1, for a singleton row)