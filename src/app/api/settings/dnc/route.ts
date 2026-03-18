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
    .from('dnc_list')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false });

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const { supabase, workspace, error } = await getSupabaseAndWorkspace();
  if (error || !workspace) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 404 });

  const { phone, reason } = await request.json();
  if (!phone) return NextResponse.json({ error: 'Phone number required' }, { status: 400 });

  const { data, error: insertError } = await supabase
    .from('dnc_list')
    .upsert(
      {
        workspace_id: workspace.id,
        phone_number: phone,
        reason: reason || null,
        added_by: 'manual',
      },
      { onConflict: 'workspace_id,phone_number' }
    )
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const { supabase, workspace, error } = await getSupabaseAndWorkspace();
  if (error || !workspace) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 404 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  await supabase
    .from('dnc_list')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspace.id);

  return NextResponse.json({ ok: true });
}
