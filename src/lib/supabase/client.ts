import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client using the anon key.
 * Respects RLS policies.
 */
export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Add these to your .env.local file or Vercel environment variables.'
    );
  }

  return createBrowserClient(url, key);
}
