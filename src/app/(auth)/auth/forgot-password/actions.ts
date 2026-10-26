// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { redirect } from 'next/navigation';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { CAPTCHA_MESSAGE, captchaTokenFrom, isCaptchaError } from '@/lib/captcha';
import { normalizeGhanaPhone, toE164 } from '@/lib/phone';

const PHONE_ERROR = 'Enter a valid Ghana phone number, e.g. 024 123 4567.';

/**
 * Step 1 of "forgot password" for phone accounts: text a 6-digit code.
 * Also used by the "Resend code" button (it needs a fresh CAPTCHA token each time).
 */
export async function requestPhoneResetCode(formData: FormData) {
  const e164 = toE164(String(formData.get('phone') ?? ''));
  if (!e164) return { error: PHONE_ERROR };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    phone: e164,
    // Never create an account from the reset form.
    options: { shouldCreateUser: false, captchaToken: captchaTokenFrom(formData) },
  });

  if (error) {
    if (isCaptchaError(error.message)) return { error: CAPTCHA_MESSAGE };
    if (/rate limit|too many|seconds/i.test(error.message)) {
      return { error: 'Please wait a minute before asking for another code.' };
    }
    // "Signups not allowed" means there is no account for this number. Don't say so:
    // the page behaves the same either way, so nobody can use it to find out who is registered.
    const noAccount = error.code === 'otp_disabled' || /signups? not allowed|user not found/i.test(error.message);
    if (!noAccount) return { error: 'We could not send the code. Please try again in a moment.' };
  }

  return { success: true, phone: e164 };
}

/**
 * Step 2: check the code. The code signs the person in, so we send them straight to the
 * existing "choose a new password" page (the same one the email reset link uses).
 */
export async function verifyResetCode(formData: FormData) {
  const phone = String(formData.get('phone') ?? '');
  const code = String(formData.get('code') ?? '').replace(/\D/g, '');
  if (code.length !== 6) return { error: 'Enter the 6-digit code.' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
  if (error || !data.user) return { error: 'That code is incorrect or has expired.' };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
  if (profile?.role === 'staff' || profile?.role === 'admin') {
    await supabase.auth.signOut();
    return { error: 'Staff and admin accounts reset their password by email.' };
  }

  // They have proved they own this number, so lift any login lockout on it.
  const local = normalizeGhanaPhone(phone);
  if (local) await createServiceRoleClient().from('login_attempts').delete().eq('email', local);

  redirect('/auth/set-password?mode=reset');
}