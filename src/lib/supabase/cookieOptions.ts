// STRAYMUTANT.DEV — Tamak Bookshop
// One source of truth for the Supabase session cookie, so the browser client,
// the server client and the middleware all write the SAME cookie.
//
// DEVELOPMENT: always a host-only cookie (no Domain attribute), whatever .env.local says.
//   Browsers disagree about Domain=.localhost cookies and have changed over time, which
//   made login depend on the machine and browser version. A host-only cookie behaves
//   the same everywhere. The cost: log in separately on localhost:3000 and admin.localhost:3000.
// PRODUCTION: NEXT_PUBLIC_COOKIE_DOMAIN=.tamakbookshop.com (Vercel Production only) shares
//   one login between tamakbookshop.com and admin.tamakbookshop.com.
// PREVIEW deployments: leave it unset, so the cookie is host-only and login works on *.vercel.app.
export function sessionCookieOptions() {
  const isDev = process.env.NODE_ENV === 'development';
  const configured = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;
  const domain = isDev || !configured || configured === 'host-only' ? undefined : configured;

  return {
    ...(domain ? { domain } : {}),
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  };
}