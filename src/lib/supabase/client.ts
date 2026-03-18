import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client using the anon key.
 * Respects RLS policies.
 */
export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createBrowserClient(url, key);
}
