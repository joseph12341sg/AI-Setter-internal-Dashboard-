import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function getSupabaseAndWorkspace() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(c) { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, workspace: null, error: 'Unauthorized' };

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  return { supabase, workspace, error: workspace ? null : 'No workspace' };
}

export async function GET() {
  const { supabase, workspace, error } = await getSupabaseAndWorkspace();
  if (error || !workspace) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 404 });

  const { data } = await supabase
    .from('dialler_settings')
    .select('*')
    .eq('workspace_id', workspace.id)
    .single();

  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const { supabase, workspace, error } = await getSupabaseAndWorkspace();
  if (error || !workspace) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 404 });

  const body = await request.json();

  // Only allow updating specific fields
  const allowedFields = [
    'global_kill_switch', 'inbound_delay_seconds',
    'agent1_call_windows', 'agent2_call_windows', 'agent3_call_windows',
    'active_days', 'blackout_dates', 'voicemail_behaviour',
    'max_inbound_attempts', 'double_dial_enabled',
    'slack_webhook_url', 'slack_channel_booked', 'slack_channel_no_answer', 'slack_channel_alerts',
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error: updateError } = await supabase
    .from('dialler_settings')
    .update(updates)
    .eq('workspace_id', workspace.id)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json(data);
}
