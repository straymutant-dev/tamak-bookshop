// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { redirect } from 'next/navigation';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { CAPTCHA_MESSAGE, captchaTokenFrom, isCaptchaError } from '@/lib/captcha';

const MAX_FAILED_ATTEMPTS = 6;
const LOCKOUT_MINUTES = 15;

const DASHBOARD_BY_ROLE: Record<string, string> = {
  admin: '/admin/dashboard',
  staff: '/admin/dashboard',
  vendor: '/vendor/dashboard',
  client: '/account/dashboard',
};

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const redirectTo = String(formData.get('redirectTo') ?? '');

  const service = createServiceRoleClient();

  const { data: attempt } = await service
    .from('login_attempts')
    .select('failed_count, locked_until')
    .eq('email', email)
    .maybeSingle();

  if (attempt?.locked_until && new Date(attempt.locked_until) > new Date()) {
    const minutesLeft = Math.ceil((new Date(attempt.locked_until).getTime() - Date.now()) / 60000);
    redirect(
      `/auth/login?error=${encodeURIComponent(
        `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`
      )}`
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken: captchaTokenFrom(formData) },
  });

  // A failed security check is not a wrong password: don't count it towards the lockout.
  if (isCaptchaError(error?.message)) {
    redirect(`/auth/login?error=${encodeURIComponent(CAPTCHA_MESSAGE)}`);
  }

  if (error || !data.user) {
    const nextCount = (attempt?.failed_count ?? 0) + 1;
    const lockedUntil =
      nextCount >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString() : null;

    await service.from('login_attempts').upsert({
      email,
      failed_count: lockedUntil ? 0 : nextCount,
      locked_until: lockedUntil,
      last_attempt_at: new Date().toISOString(),
    });

    const message = lockedUntil
      ? `Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`
      : error?.message?.toLowerCase().includes('email not confirmed')
        ? 'Please confirm your email first — check your inbox for the link we sent.'
        : error?.message ?? 'Invalid credentials';

    redirect(`/auth/login?error=${encodeURIComponent(message)}`);
  }

  // Successful login clears any prior failed-attempt record for this email.
  await service.from('login_attempts').delete().eq('email', email);

   const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, last_login_at')
    .eq('id', data.user!.id)
    .single();

  if (profile?.role === 'admin' || profile?.role === 'staff') {
    await supabase.auth.signOut();
    redirect(
      `/auth/login?error=${encodeURIComponent('Staff and admin accounts must sign in through the admin portal.')}`
    );
  }

  const isFirstLogin = !profile?.last_login_at;
  await supabase.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', data.user!.id);
  const welcomeMessage = `${isFirstLogin ? 'Welcome' : 'Welcome back'}, ${profile?.full_name ?? 'there'}!`;

  const destination = redirectTo || DASHBOARD_BY_ROLE[profile?.role ?? 'client'] || '/store';
  const separator = destination.includes('?') ? '&' : '?';
  redirect(`${destination}${separator}toast=${encodeURIComponent(welcomeMessage)}`);}