// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { redirect } from 'next/navigation';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { CAPTCHA_MESSAGE, captchaTokenFrom, isCaptchaError } from '@/lib/captcha';

const MAX_FAILED_ATTEMPTS = 6;
const LOCKOUT_MINUTES = 15;

export async function adminLogin(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  const service = createServiceRoleClient();

  const { data: attempt } = await service
    .from('login_attempts')
    .select('failed_count, locked_until')
    .eq('email', email)
    .maybeSingle();

  if (attempt?.locked_until && new Date(attempt.locked_until) > new Date()) {
    const minutesLeft = Math.ceil((new Date(attempt.locked_until).getTime() - Date.now()) / 60000);
    redirect(
      `/admin-login?error=${encodeURIComponent(
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
    redirect(`/admin-login?error=${encodeURIComponent(CAPTCHA_MESSAGE)}`);
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
    redirect(
      `/admin-login?error=${encodeURIComponent(
        lockedUntil ? `Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.` : error?.message ?? 'Invalid credentials'
      )}`
    );
  }

  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', data.user!.id).single();

  if (profile?.role !== 'admin' && profile?.role !== 'staff') {
    await supabase.auth.signOut();
    redirect(`/admin-login?error=${encodeURIComponent('This login is for staff and admin accounts only.')}`);
  }

  await service.from('login_attempts').delete().eq('email', email);
  redirect(`/dashboard?toast=${encodeURIComponent(`Welcome back, ${profile?.full_name ?? 'there'}!`)}`);
}