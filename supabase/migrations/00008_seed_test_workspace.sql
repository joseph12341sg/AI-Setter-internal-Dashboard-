-- Migration: Seed a test workspace for development
-- This uses a placeholder owner_id. In production, a real auth.users ID is required.
-- For local development, create a Supabase auth user first, then update this ID.

-- NOTE: This seed migration is meant for local/dev environments only.
-- In production, workspaces are created through the onboarding wizard.

-- We use a DO block so this is idempotent and won't fail if auth user doesn't exist yet.
do $$
declare
  test_user_id uuid;
  test_workspace_id uuid;
begin
  -- Try to find an existing auth user (first one) for dev seeding
  select id into test_user_id from auth.users limit 1;

  -- If no auth user exists, skip seeding (will be done after first signup)
  if test_user_id is null then
    raise notice 'No auth user found — skipping seed. Create a user via Supabase Auth, then re-run.';
    return;
  end if;

  -- Check if workspace already exists for this user
  select id into test_workspace_id
    from public.workspaces
    where owner_id = test_user_id
    limit 1;

  if test_workspace_id is not null then
    raise notice 'Workspace already exists for user — skipping seed.';
    return;
  end if;

  -- Create test workspace
  insert into public.workspaces (
    name,
    owner_id,
    billing_status,
    agent_name,
    timezone,
    is_active
  ) values (
    'North Star Test Workspace',
    test_user_id,
    'active',
    'Sarah',
    'Europe/London',
    true
  )
  returning id into test_workspace_id;

  -- dialler_settings is auto-created by the trigger

  -- Seed some pipeline rules for common Close stages
  insert into public.pipeline_rules (workspace_id, close_stage_name, close_stage_id, max_attempts, gap_schedule) values
    (test_workspace_id, 'No Answer',   'stat_placeholder_no_answer',   5, '[4, 24, 48, 96]'),
    (test_workspace_id, 'Not Reached', 'stat_placeholder_not_reached', 5, '[4, 24, 48, 96]'),
    (test_workspace_id, 'No Show',     'stat_placeholder_no_show',     5, '[4, 24, 48, 96]'),
    (test_workspace_id, 'Follow Up',   'stat_placeholder_follow_up',   5, '[4, 24, 48, 96]');

  raise notice 'Seed complete — workspace ID: %', test_workspace_id;
end;
$$;
