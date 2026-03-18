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
    .from('pipeline_rules')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('close_stage_name');

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const { supabase, workspace, error } = await getSupabaseAndWorkspace();
  if (error || !workspace) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 404 });

  const body = await request.json();

  const { data, error: insertError } = await supabase
    .from('pipeline_rules')
    .insert({
      workspace_id: workspace.id,
      close_stage_name: body.close_stage_name,
      close_stage_id: body.close_stage_id,
      max_attempts: body.max_attempts || 5,
      is_enabled: body.is_enabled ?? true,
      gap_schedule: body.gap_schedule || [4, 24, 48, 96],
      outcome_booked_stage_id: body.outcome_booked_stage_id || null,
      outcome_no_answer_stage_id: body.outcome_no_answer_stage_id || null,
      outcome_disqualified_stage_id: body.outcome_disqualified_stage_id || null,
      outcome_max_attempts_stage_id: body.outcome_max_attempts_stage_id || null,
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const { supabase, workspace, error } = await getSupabaseAndWorkspace();
  if (error || !workspace) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 404 });

  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: 'Missing rule ID' }, { status: 400 });

  const updates: Record<string, unknown> = {};
  const allowed = ['is_enabled', 'max_attempts', 'gap_schedule', 'outcome_booked_stage_id', 'outcome_no_answer_stage_id', 'outcome_disqualified_stage_id', 'outcome_max_attempts_stage_id'];
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error: updateError } = await supabase
    .from('pipeline_rules')
    .update(updates)
    .eq('id', body.id)
    .eq('workspace_id', workspace.id)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json(data);
}
