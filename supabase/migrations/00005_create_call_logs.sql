-- Migration: Create call_logs table
-- Immutable audit log of every outbound call.

create type public.trigger_type as enum ('inbound', 'retry', 'confirmation');

create table public.call_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  -- Lead info
  lead_id text not null,
  lead_name text,
  lead_phone text not null,

  -- Retell call identifiers
  call_sid text,

  -- Which agent made the call
  agent_type public.agent_type not null,

  -- Call result
  outcome text,
  duration_seconds integer,

  -- Attempt context
  attempt_number integer not null default 1,
  trigger_type public.trigger_type not null,
  pipeline_stage_at_call text,

  -- Media
  recording_url text,
  transcript_url text,

  -- Variables that were injected into the Retell prompt
  variables_injected jsonb,

  -- If an appointment was booked, the slot info
  booked_slot timestamptz,

  created_at timestamptz not null default now()
);

-- Index for dashboard queries
create index idx_call_logs_workspace_created on public.call_logs(workspace_id, created_at desc);
create index idx_call_logs_outcome on public.call_logs(workspace_id, outcome);
create index idx_call_logs_agent on public.call_logs(workspace_id, agent_type);

-- RLS
alter table public.call_logs enable row level security;

create policy "Users can view own call_logs"
  on public.call_logs for select
  using (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

create policy "Users can insert own call_logs"
  on public.call_logs for insert
  with check (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

-- No update/delete — call logs are immutable
