// STRAYMUTANT.DEV — Tamak Bookshop
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Older versions of this project stored the login cookie with Domain=.localhost.
// A leftover one can sit next to the new host-only cookie and be read first, which
// bounces you back to the login page. In development, when you open a login page,
// tell the browser to forget any such leftover. The new cookie is unaffected.
const LOGIN_PATHS = ['/login', '/auth/login'];

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  if (
    process.env.NODE_ENV === 'development' &&
    request.method === 'GET' &&
    LOGIN_PATHS.includes(request.nextUrl.pathname)
  ) {
    for (const { name } of request.cookies.getAll()) {
      if (name.startsWith('sb-')) {
        response.headers.append('Set-Cookie', `${name}=; Path=/; Domain=.localhost; Max-Age=0; SameSite=Lax`);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};