import { updateSession } from '@/lib/supabase/middleware';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Match all dashboard routes and auth routes
    '/dashboard/:path*',
    '/login',
    '/onboarding',
    '/',
  ],
};
