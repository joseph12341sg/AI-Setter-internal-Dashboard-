-- Migration: Create retry_queue table
-- Tracks every lead that needs a call, across all agent types.

create type public.agent_type as enum ('agent1', 'agent2', 'agent3');
create type public.retry_status as enum ('pending', 'in_progress', 'completed', 'exhausted', 'dnc');

create table public.retry_queue (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  -- Lead info from Close CRM
  lead_id text not null,
  lead_phone text not null,
  lead_name text,
  lead_email text,
  firm_name text,

  -- Which agent handles this entry
  agent_type public.agent_type not null,

  -- Current Close pipeline stage
  pipeline_stage text,

  -- Attempt tracking
  attempt_number integer not null default 1,

  -- When to make the next call (null = immediate / already completed)
  next_call_at timestamptz,

  -- Current status
  status public.retry_status not null default 'pending',

  -- Last call outcome
  last_outcome text,

  -- QStash job ID for cancellation
  qstash_job_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for the retry scheduler query: pending items due now
create index idx_retry_queue_pending on public.retry_queue(workspace_id, status, next_call_at)
  where status = 'pending';

-- Index for looking up a lead's queue entry
create index idx_retry_queue_lead on public.retry_queue(workspace_id, lead_id);

-- RLS
alter table public.retry_queue enable row level security;

create policy "Users can view own retry_queue"
  on public.retry_queue for select
  using (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

create policy "Users can insert own retry_queue"
  on public.retry_queue for insert
  with check (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

create policy "Users can update own retry_queue"
  on public.retry_queue for update
  using (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );
