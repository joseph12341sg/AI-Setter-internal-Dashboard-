-- Migration: Create pipeline_rules table
-- Maps Close CRM pipeline stages to retry behaviour and outcome routing.

create table public.pipeline_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  -- Close CRM stage identifiers
  close_stage_name text not null,
  close_stage_id text not null,

  -- Retry config
  max_attempts integer not null default 5,
  is_enabled boolean not null default true,

  -- Gap schedule: hours between each retry attempt [4, 24, 48, 96]
  gap_schedule jsonb not null default '[4, 24, 48, 96]'::jsonb,

  -- Outcome routing: which Close stage to move lead to for each outcome
  outcome_booked_stage_id text,
  outcome_no_answer_stage_id text,
  outcome_disqualified_stage_id text,
  outcome_max_attempts_stage_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Each stage can only appear once per workspace
  unique(workspace_id, close_stage_id)
);

create index idx_pipeline_rules_workspace on public.pipeline_rules(workspace_id);

-- RLS
alter table public.pipeline_rules enable row level security;

create policy "Users can view own pipeline_rules"
  on public.pipeline_rules for select
  using (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

create policy "Users can insert own pipeline_rules"
  on public.pipeline_rules for insert
  with check (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

create policy "Users can update own pipeline_rules"
  on public.pipeline_rules for update
  using (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

create policy "Users can delete own pipeline_rules"
  on public.pipeline_rules for delete
  using (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );
