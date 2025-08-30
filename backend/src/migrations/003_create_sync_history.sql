-- Table for storing full worker stats as JSONB for each run
create table if not exists public.sync_history (
  id BIGSERIAL primary key,
  created_at TIMESTAMPTZ not null default now(),
  stats JSONB not null
);

-- Index for efficient time-based queries
create index IF not exists idx_sync_history_created_at on public.sync_history (created_at);

-- Enable Row Level Security (RLS)
alter table public.sync_history ENABLE row LEVEL SECURITY;

-- Allow service role full access
create policy "Allow service role full access" on public.sync_history using (auth.role () = 'service_role');