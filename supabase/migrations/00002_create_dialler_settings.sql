-- Migration: Create dialler_settings table
-- Per-workspace calling configuration.

create table public.dialler_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,

  -- Master kill switch — instantly stops all outbound calls
  global_kill_switch boolean not null default false,

  -- Delay between Close webhook and first call (seconds)
  inbound_delay_seconds integer not null default 60,

  -- Calling windows per agent (jsonb arrays of {start, end} objects)
  -- Agent 1 & 2 default: 12:00-14:00, 18:00-20:00
  agent1_call_windows jsonb not null default '[{"start":"12:00","end":"14:00"},{"start":"18:00","end":"20:00"}]'::jsonb,
  agent2_call_windows jsonb not null default '[{"start":"12:00","end":"14:00"},{"start":"18:00","end":"20:00"}]'::jsonb,
  -- Agent 3 default: 09:00-10:00
  agent3_call_windows jsonb not null default '[{"start":"09:00","end":"10:00"}]'::jsonb,

  -- Days of week when calls are allowed (0=Sun, 1=Mon, ..., 6=Sat)
  active_days integer[] not null default '{1,2,3,4,5,6,0}',

  -- Specific dates to block all calls
  blackout_dates date[] not null default '{}',

  -- Voicemail behaviour
  voicemail_behaviour text not null default 'leave_message'
    check (voicemail_behaviour in ('hang_up', 'leave_message', 'leave_on_final_only')),

  -- Max attempts for Agent 1 inbound trigger
  max_inbound_attempts integer not null default 1,

  -- Double-dial on first attempt
  double_dial_enabled boolean not null default true,

  -- Slack notification config
  slack_webhook_url text,
  slack_channel_booked text,
  slack_channel_no_answer text,
  slack_channel_alerts text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.dialler_settings enable row level security;

create policy "Users can view own dialler_settings"
  on public.dialler_settings for select
  using (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

create policy "Users can insert own dialler_settings"
  on public.dialler_settings for insert
  with check (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

create policy "Users can update own dialler_settings"
  on public.dialler_settings for update
  using (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );
