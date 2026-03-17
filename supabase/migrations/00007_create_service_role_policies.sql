-- Migration: Service role bypass policies
-- API routes use the Supabase service role key to bypass RLS.
-- This migration creates a helper function and ensures the service role
-- can access all tables (it does by default in Supabase, but we make it explicit).

-- Helper function: given a user ID, return their workspace ID.
-- Used by API routes to scope all queries.
create or replace function public.get_workspace_id_for_user(user_id uuid)
returns uuid
language sql
security definer
stable
as $$
  select id from public.workspaces where owner_id = user_id limit 1;
$$;

-- Helper function: auto-create dialler_settings when a workspace is created.
create or replace function public.auto_create_dialler_settings()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.dialler_settings (workspace_id)
  values (new.id);
  return new;
end;
$$;

create trigger trg_workspace_create_settings
  after insert on public.workspaces
  for each row
  execute function public.auto_create_dialler_settings();

-- Updated_at auto-touch triggers
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_dialler_settings_updated
  before update on public.dialler_settings
  for each row execute function public.touch_updated_at();

create trigger trg_pipeline_rules_updated
  before update on public.pipeline_rules
  for each row execute function public.touch_updated_at();

create trigger trg_retry_queue_updated
  before update on public.retry_queue
  for each row execute function public.touch_updated_at();
