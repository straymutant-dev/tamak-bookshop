// STRAYMUTANT.DEV — Tamak Bookshop
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { sessionCookieOptions } from './cookieOptions';

type Role = 'client' | 'vendor' | 'staff' | 'admin';

interface Profile {
  role: Role;
  is_super_admin: boolean;
}

interface RouteRule {
  prefix: string;
  allowedRoles: Role[];
  requireSuperAdmin?: boolean;
  redirectTo?: string; // internal /admin/... path, stripped automatically for the admin host
}

const ROUTE_RULES: RouteRule[] = [
  { prefix: '/admin/team', allowedRoles: ['admin'], requireSuperAdmin: true, redirectTo: '/admin/inventory' },
  { prefix: '/admin/staff', allowedRoles: ['admin'], redirectTo: '/admin/inventory' },
  { prefix: '/admin/vendors', allowedRoles: ['admin'], redirectTo: '/admin/inventory' },
  { prefix: '/admin/activity', allowedRoles: ['admin'], redirectTo: '/admin/inventory' },
  { prefix: '/admin/approvals', allowedRoles: ['admin', 'staff'] },
  { prefix: '/admin/repayments', allowedRoles: ['admin', 'staff'] },
  { prefix: '/admin/shift', allowedRoles: ['admin', 'staff'] },
  { prefix: '/admin/orders', allowedRoles: ['admin', 'staff'], redirectTo: '/admin/inventory' },
  { prefix: '/admin/pos', allowedRoles: ['admin', 'staff'] },
  { prefix: '/admin/inventory', allowedRoles: ['admin', 'staff'] },
  { prefix: '/admin', allowedRoles: ['admin', 'staff'] },
];

// Tells "the server could not be reached" apart from "you are not logged in".
// Without this, a dropped connection looked exactly like a logout and sent you
// back to the login page, even though your login was fine.
function isNetworkError(error: { name?: string; message?: string; status?: number } | null) {
  if (!error) return false;
  if (error.name === 'AuthRetryableFetchError') return true;
  if (typeof error.status === 'number' && (error.status === 0 || error.status >= 500)) return true;
  return /fetch failed|ECONN|EAI_AGAIN|ETIMEDOUT|ENOTFOUND|network/i.test(error.message ?? '');
}

function unreachableResponse() {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Can't reach the server</title>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.5rem;color:#222">
<h1 style="font-size:1.25rem">Can't reach the server right now</h1>
<p>Your login is fine. The connection to the database didn't answer. Check your internet connection and refresh this page in a few seconds.</p>
<p><a href="" onclick="location.reload();return false">Refresh</a></p>`,
    { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'retry-after': '5' } }
  );
}

// Browser / crawler files that must be served as-is on BOTH hosts. Without this the admin
// host would rewrite /robots.txt to /admin/robots.txt (a 404), and the admin tab would have no icon.
const METADATA_PATHS = new Set([
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.webmanifest',
  '/icon',
  '/apple-icon',
  '/opengraph-image',
]);

function isMetadataRoute(pathname: string) {
  return METADATA_PATHS.has(pathname) || pathname.startsWith('/pwa-icon/');
}

export async function updateSession(request: NextRequest) {
  if (isMetadataRoute(request.nextUrl.pathname)) return NextResponse.next({ request });

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
      cookieOptions: sessionCookieOptions(),
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  const authUnreachable = isNetworkError(authError);
  if (process.env.NODE_ENV === 'development' && authError && authError.name !== 'AuthSessionMissingError') {
    console.warn('[auth] getUser failed:', authError.name, '-', authError.message);
  }

  const hostname = (request.headers.get('host') ?? request.nextUrl.hostname).split(':')[0];
  const onAdminHost = hostname.startsWith('admin.');
  const rootDomain = onAdminHost ? hostname.slice('admin.'.length) : hostname;
  const originalPath = request.nextUrl.pathname;

  let profile: Profile | null = null;
  let profileUnreachable = false;
  if (user) {
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('role, is_super_admin')
      .eq('id', user.id)
      .single();
    if (data) profile = { role: data.role as Role, is_super_admin: Boolean(data.is_super_admin) };
    else if (profileError && profileError.code !== 'PGRST116') {
      profileUnreachable = true;
      if (process.env.NODE_ENV === 'development') {
        console.warn('[auth] profile lookup failed:', profileError.code, '-', profileError.message);
      }
    }
  }

  // The customer-facing host must never serve /admin/* — bounce to the admin host.
  if (!onAdminHost && originalPath.startsWith('/admin')) {
    const target = request.nextUrl.clone();
    target.hostname = `admin.${rootDomain}`;
    target.pathname = originalPath.slice('/admin'.length) || '/';
    return NextResponse.redirect(target);
  }

  // Map the external (no-/admin-prefix) admin-host URL to its real internal path.
  let effectivePath = originalPath;
  if (onAdminHost) {
    if (originalPath === '/login') effectivePath = '/admin-login';
    else if (originalPath === '/') effectivePath = '/admin/inventory';
    else if (originalPath.startsWith('/admin')) effectivePath = originalPath;
    else if (originalPath.startsWith('/account') || originalPath.startsWith('/api') || originalPath.startsWith('/about')) effectivePath = originalPath; // shared routes — serve as-is, no admin prefix
    else effectivePath = `/admin${originalPath}`;
  }

  // Already-authenticated staff/admin skip the admin-host login form.
  if (onAdminHost && effectivePath === '/admin-login' && profile && (profile.role === 'admin' || profile.role === 'staff')) {
    const dest = request.nextUrl.clone();
    dest.pathname = '/inventory';
    return NextResponse.redirect(dest);
  }

  // Staff/admin shouldn't authenticate via the main-host login at all —
  // send them to the admin host instead (the actual hard-block on a
  // mismatched role lives in each login form's own server action).
  if (!onAdminHost && originalPath === '/auth/login' && profile && (profile.role === 'admin' || profile.role === 'staff')) {
    const target = request.nextUrl.clone();
    target.hostname = `admin.${rootDomain}`;
    target.pathname = '/inventory';
    return NextResponse.redirect(target);
  }

  const rule = ROUTE_RULES.find((r) => effectivePath === r.prefix || effectivePath.startsWith(`${r.prefix}/`));

  if (rule) {
    // We could not check who this is. Say so, instead of pretending they are logged out.
    if (authUnreachable || profileUnreachable) return unreachableResponse();

    if (!user) {
      const dest = request.nextUrl.clone();
      if (onAdminHost) {
        dest.pathname = '/login';
      } else {
        dest.pathname = '/auth/login';
        dest.searchParams.set('redirectTo', originalPath);
        dest.searchParams.set('unauthorized', '1');
      }
      return NextResponse.redirect(dest);
    }

    const isStaffOrAdmin = profile?.role === 'admin' || profile?.role === 'staff';
    const roleAllowed = profile ? rule.allowedRoles.includes(profile.role) : false;
    const superAdminOk = rule.requireSuperAdmin ? profile?.is_super_admin === true : true;

    if (!roleAllowed || !superAdminOk) {
      const dest = request.nextUrl.clone();
      if (onAdminHost && !isStaffOrAdmin) {
        // A client/vendor session has no business on the admin host at all.
        dest.hostname = rootDomain;
        dest.pathname = '/';
      } else if (onAdminHost) {
        // Staff hitting an admin-only sub-route — send to something they can reach.
        dest.pathname = (rule.redirectTo ?? '/admin/inventory').replace(/^\/admin/, '') || '/';
      } else {
        dest.pathname = rule.redirectTo ?? '/';
      }
      return NextResponse.redirect(dest);
    }
  }

  if (onAdminHost && effectivePath !== originalPath) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = effectivePath;
    const rewritten = NextResponse.rewrite(rewriteUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => rewritten.cookies.set(cookie));
    return rewritten;
  }

  return supabaseResponse;
}