-- Migration: Create workspaces table
-- The core tenant table. Every other table references workspace_id.

-- Enable pgcrypto for UUID generation
create extension if not exists "pgcrypto";

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  billing_status text not null default 'active' check (billing_status in ('active', 'trialing', 'past_due', 'cancelled')),

  -- Retell integration (encrypted at application layer)
  retell_api_key text,
  retell_agent_1_id text,
  retell_agent_2_id text,
  retell_agent_3_id text,
  retell_phone_number text,

  -- Close CRM integration (encrypted at application layer)
  close_api_key text,

  -- Agent display name (replaces [AGENT_NAME_PLACEHOLDER] in prompts)
  agent_name text,

  -- Timezone for calling-hours logic
  timezone text not null default 'Europe/London',

  -- Master on/off for this workspace
  is_active boolean not null default true
);

-- Index for fast lookup by owner
create index idx_workspaces_owner_id on public.workspaces(owner_id);

-- RLS
alter table public.workspaces enable row level security;

-- Users can only see workspaces they own
create policy "Users can view own workspaces"
  on public.workspaces for select
  using (owner_id = auth.uid());

create policy "Users can insert own workspaces"
  on public.workspaces for insert
  with check (owner_id = auth.uid());

create policy "Users can update own workspaces"
  on public.workspaces for update
  using (owner_id = auth.uid());

-- No delete policy — workspaces are deactivated, not deleted
