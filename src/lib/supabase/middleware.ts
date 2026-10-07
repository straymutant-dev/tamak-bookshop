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

export async function updateSession(request: NextRequest) {
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
  } = await supabase.auth.getUser();

  const hostname = (request.headers.get('host') ?? request.nextUrl.hostname).split(':')[0];
  const onAdminHost = hostname.startsWith('admin.');
  const rootDomain = onAdminHost ? hostname.slice('admin.'.length) : hostname;
  const originalPath = request.nextUrl.pathname;

  let profile: Profile | null = null;
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('role, is_super_admin')
      .eq('id', user.id)
      .single();
    if (data) profile = { role: data.role as Role, is_super_admin: Boolean(data.is_super_admin) };
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