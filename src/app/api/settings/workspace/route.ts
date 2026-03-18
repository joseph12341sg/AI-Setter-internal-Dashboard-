import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { encrypt } from '@/lib/encryption';

async function getSupabaseAndUser() {
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
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await getSupabaseAndUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('workspaces')
    .select('id, name, agent_name, timezone, is_active, billing_status, retell_agent_1_id, retell_agent_2_id, retell_agent_3_id, retell_phone_number, created_at')
    .eq('owner_id', user.id)
    .single();

  // Don't return API keys in GET — they're encrypted and sensitive
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const { supabase, user } = await getSupabaseAndUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  // Plain text fields
  const plainFields = ['name', 'agent_name', 'timezone', 'retell_agent_1_id', 'retell_agent_2_id', 'retell_agent_3_id', 'retell_phone_number'];
  for (const key of plainFields) {
    if (key in body) updates[key] = body[key];
  }

  // Encrypt API keys if provided
  if (body.retell_api_key) updates.retell_api_key = encrypt(body.retell_api_key);
  if (body.close_api_key) updates.close_api_key = encrypt(body.close_api_key);

  const { data, error } = await supabase
    .from('workspaces')
    .update(updates)
    .eq('owner_id', user.id)
    .select('id, name, agent_name, timezone, is_active, retell_agent_1_id, retell_agent_2_id, retell_agent_3_id, retell_phone_number')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
