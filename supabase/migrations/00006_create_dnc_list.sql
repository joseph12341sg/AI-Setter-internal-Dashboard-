-- Migration: Create dnc_list (Do Not Call) table
-- Numbers that must never be dialled again.

create type public.dnc_source as enum ('manual', 'auto_request', 'csv_import');

create table public.dnc_list (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  phone_number text not null,
  reason text,
  added_by public.dnc_source not null default 'manual',

  created_at timestamptz not null default now(),

  -- A phone number can only appear once per workspace
  unique(workspace_id, phone_number)
);

create index idx_dnc_lookup on public.dnc_list(workspace_id, phone_number);

-- RLS
alter table public.dnc_list enable row level security;

create policy "Users can view own dnc_list"
  on public.dnc_list for select
  using (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

create policy "Users can insert own dnc_list"
  on public.dnc_list for insert
  with check (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

create policy "Users can delete own dnc_list"
  on public.dnc_list for delete
  using (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );
