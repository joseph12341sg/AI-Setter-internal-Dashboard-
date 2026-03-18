import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { encrypt } from '@/lib/encryption';

/**
 * POST /api/settings/onboarding
 *
 * Creates a new workspace with the provided configuration.
 * Called from the onboarding wizard after all steps are complete.
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Check if user already has a workspace
  const { data: existing } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Workspace already exists' }, { status: 409 });
  }

  const body = await request.json();

  // Validate required fields
  if (!body.workspaceName || body.workspaceName.length < 2) {
    return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 });
  }

  // Encrypt API keys before storing
  const encryptedCloseKey = body.closeApiKey ? encrypt(body.closeApiKey) : null;
  const encryptedRetellKey = body.retellApiKey ? encrypt(body.retellApiKey) : null;

  // Create workspace (dialler_settings auto-created by trigger)
  const { data: workspace, error: createError } = await supabase
    .from('workspaces')
    .insert({
      name: body.workspaceName,
      owner_id: user.id,
      close_api_key: encryptedCloseKey,
      retell_api_key: encryptedRetellKey,
      retell_agent_1_id: body.retellAgent1Id || null,
      retell_agent_2_id: body.retellAgent2Id || null,
      retell_agent_3_id: body.retellAgent3Id || null,
      retell_phone_number: body.retellPhoneNumber || null,
      agent_name: body.agentName || 'Sarah',
      timezone: body.timezone || 'Europe/London',
      billing_status: 'active',
      is_active: true,
    })
    .select('id')
    .single();

  if (createError || !workspace) {
    console.error('Failed to create workspace:', createError);
    return NextResponse.json(
      { error: 'Failed to create workspace' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, workspaceId: workspace.id });
}
