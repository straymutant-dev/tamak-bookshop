// STRAYMUTANT.DEV — Tamak Bookshop
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { sessionCookieOptions } from "./cookieOptions";

/**
 * Supabase client for use in Server Components and Server Actions.
 * Reads/writes the session via Next.js cookies(). Must be created fresh
 * per request (do not cache/reuse across requests).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — safe to ignore
            // when middleware is refreshing sessions.
          }
        },
      },
      cookieOptions: sessionCookieOptions(),
    }
  );
}

/**
 * Service-role client for privileged, server-only operations that must
 * bypass RLS (e.g. admin credit-limit changes, vendor approval).
 *
 * SECURITY: never import this file from a Client Component, and never
 * forward this client's results directly to the browser without checking
 * the caller's role first — it has full read/write access to every table.
 */
export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}