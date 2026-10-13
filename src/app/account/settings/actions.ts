// STRAYMUTANT.DEV — Tamak Bookshop
// Path: src/app/account/settings/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CAPTCHA_MESSAGE, captchaTokenFrom, isCaptchaError } from '@/lib/captcha';

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) throw new Error('Not authenticated');

  const currentPassword = String(formData.get('currentPassword') ?? '');
  const fullName = String(formData.get('fullName') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();

  if (!fullName) throw new Error('Full name is required');

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
    options: { captchaToken: captchaTokenFrom(formData) },
  });
  if (verifyError) {
    throw new Error(isCaptchaError(verifyError.message) ? CAPTCHA_MESSAGE : 'Current password is incorrect');
  }

  const { error } = await supabase.from('profiles').update({ full_name: fullName, phone }).eq('id', user.id);
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
  if (!user?.email) throw new Error('Not authenticated');

  // Verify the current password by attempting a fresh sign-in with it,
  // rather than trusting the active session alone.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
    options: { captchaToken: captchaTokenFrom(formData) },
  });
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