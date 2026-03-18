import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * GET /auth/callback
 *
 * Handles the OAuth/magic link callback from Supabase Auth.
 * Exchanges the code for a session, then redirects to dashboard or onboarding.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
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

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if user has a workspace — if not, redirect to onboarding
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('id')
          .eq('owner_id', user.id)
          .limit(1)
          .single();

        if (!workspace) {
          return NextResponse.redirect(new URL('/onboarding', request.url));
        }
      }

      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  // Auth error — redirect to login with error
  return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
}
