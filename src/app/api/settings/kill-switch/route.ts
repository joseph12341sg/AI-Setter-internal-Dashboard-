import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
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
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  if (!workspace) return NextResponse.json({ error: 'No workspace' }, { status: 404 });

  const { enabled, password } = await request.json();

  if (password !== '287652') {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 403 });
  }

  await supabase
    .from('dialler_settings')
    .update({ global_kill_switch: !!enabled })
    .eq('workspace_id', workspace.id);

  return NextResponse.json({ ok: true, global_kill_switch: !!enabled });
}
