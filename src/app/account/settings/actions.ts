// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { parseEmail } from '@/lib/email';
import { CAPTCHA_MESSAGE, captchaTokenFrom, isCaptchaError } from '@/lib/captcha';

// Re-checks the current password. Email accounts sign in with their email, phone accounts with their phone.
function credentialsFor(user: User, password: string, captchaToken: string | undefined) {
  const options = { captchaToken };
  if (user.email) return { email: user.email, password, options };
  if (user.phone) return { phone: user.phone.startsWith('+') ? user.phone : `+${user.phone}`, password, options };
  return null;
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const currentPassword = String(formData.get('currentPassword') ?? '');
  const fullName = String(formData.get('fullName') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();

  if (!fullName) throw new Error('Full name is required');

  const credentials = credentialsFor(user, currentPassword, captchaTokenFrom(formData));
  if (!credentials) throw new Error('Not authenticated');
  const { error: verifyError } = await supabase.auth.signInWithPassword(credentials);
  if (verifyError) {
    throw new Error(isCaptchaError(verifyError.message) ? CAPTCHA_MESSAGE : 'Current password is incorrect');
  }

  // A phone account's number is its login, verified by SMS code, so it can't be edited here.
  // They can add or change the email their receipts go to (email accounts use their account email).
  const update = user.email
    ? { full_name: fullName, phone }
    : { full_name: fullName, contact_email: parseEmail(formData.get('contactEmail')) };
  const { error } = await supabase.from('profiles').update(update).eq('id', user.id);
  if (error) throw new Error(error.message);

  revalidatePath('/account/settings');
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  const currentPassword = String(formData.get('currentPassword') ?? '');
  const newPassword = String(formData.get('newPassword') ?? '');

  if (newPassword.length < 8) throw new Error('New password must be at least 8 characters');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Verify the current password by attempting a fresh sign-in with it,
  // rather than trusting the active session alone.
  const credentials = credentialsFor(user, currentPassword, captchaTokenFrom(formData));
  if (!credentials) throw new Error('Not authenticated');
  const { error: verifyError } = await supabase.auth.signInWithPassword(credentials);
  if (verifyError) {
    throw new Error(isCaptchaError(verifyError.message) ? CAPTCHA_MESSAGE : 'Current password is incorrect');
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/?toast=${encodeURIComponent('Signed out successfully')}`);
}