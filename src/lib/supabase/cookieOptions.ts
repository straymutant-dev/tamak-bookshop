// STRAYMUTANT.DEV — Tamak Bookshop
// One source of truth for the Supabase session cookie, so the browser client,
// the server client and the middleware all write the SAME cookie.
//
// NEXT_PUBLIC_COOKIE_DOMAIN controls the cookie's domain:
//   dev (.env.local)        .localhost            -> shared by localhost and admin.localhost
//   Vercel Production only  .tamakbookshop.com    -> shared by tamakbookshop.com and admin.tamakbookshop.com
//   Vercel Preview          (leave unset)         -> host-only cookie, so login works on *.vercel.app
// In `next dev` an unset value falls back to .localhost so local login keeps working.
export function sessionCookieOptions() {
  const domain =
    process.env.NEXT_PUBLIC_COOKIE_DOMAIN ||
    (process.env.NODE_ENV === 'development' ? '.localhost' : undefined);

  return {
    ...(domain ? { domain } : {}),
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  };
}