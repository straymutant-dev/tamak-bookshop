// STRAYMUTANT.DEV — Tamak Bookshop
import { createBrowserClient } from '@supabase/ssr';

const SESSION_COOKIE_OPTIONS = {
  domain: process.env.NODE_ENV === 'production' ? '.tamakbookshop.com' : '.localhost',
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
};

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: SESSION_COOKIE_OPTIONS }
  );
}