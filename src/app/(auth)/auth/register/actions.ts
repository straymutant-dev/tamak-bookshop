// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CAPTCHA_MESSAGE, captchaTokenFrom, isCaptchaError } from '@/lib/captcha';
import { normalizeGhanaPhone, toE164 } from '@/lib/phone';
import { parseEmail } from '@/lib/email';

const PHONE_ERROR = 'Enter a valid Ghana phone number, e.g. 024 123 4567.';

async function startRegistration(formData: FormData, role: 'client' | 'vendor') {
  const password = String(formData.get('password') ?? '');
  const fullName = String(formData.get('fullName') ?? '').trim();
  const businessName = String(formData.get('businessName') ?? '').trim();
  const rawPhone = String(formData.get('phone') ?? '');

  const e164 = toE164(rawPhone);
  const local = normalizeGhanaPhone(rawPhone);
  if (!e164 || !local) return { error: PHONE_ERROR };

  // Optional: where receipts are emailed. Saved to the profile once the phone is verified.
  let contactEmail: string | null = null;
  try {
    contactEmail = parseEmail(formData.get('contactEmail'));
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Enter a valid email address' };
  }

  const supabase = await createClient();

  // Sends the SMS code. The user is not signed in until the code is verified.
  const { data, error } = await supabase.auth.signUp({
    phone: e164,
    password,
    options: {
      data:
        role === 'vendor'
          ? { full_name: fullName, phone: local, role: 'vendor', business_name: businessName }
          : { full_name: fullName, phone: local, role: 'client' },
      captchaToken: captchaTokenFrom(formData),
    },
  });

  if (error || !data.user) {
    if (isCaptchaError(error?.message)) return { error: CAPTCHA_MESSAGE };
    if (/already (been )?registered|already exists/i.test(error?.message ?? '')) {
      return { error: 'This number already has an account. Log in, or use "Forgot password" if you cannot remember it.' };
    }
    return { error: error?.message ?? 'Registration failed' };
  }

  return { success: true, phone: e164, email: contactEmail };
}

export async function registerClient(formData: FormData) {
  return startRegistration(formData, 'client');
}

export async function registerVendor(formData: FormData) {
  return startRegistration(formData, 'vendor');
}

/** Sends the sign-up code again. Needs a fresh CAPTCHA token (each token works once). */
export async function resendSignupCode(formData: FormData) {
  const phone = String(formData.get('phone') ?? '');
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: 'sms',
    phone,
    options: { captchaToken: captchaTokenFrom(formData) },
  });

  if (error) {
    if (isCaptchaError(error.message)) return { error: CAPTCHA_MESSAGE };
    if (/rate limit|too many|seconds/i.test(error.message)) {
      return { error: 'Please wait a minute before asking for another code.' };
    }
    return { error: 'We could not resend the code. Please try again in a moment.' };
  }
  return { success: true };
}

export async function verifyPhoneCode(formData: FormData) {
  const phone = String(formData.get('phone') ?? '');
  const code = String(formData.get('code') ?? '').replace(/\D/g, '');
  if (code.length !== 6) return { error: 'Enter the 6-digit code.' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });

  if (error || !data.user) {
    return { error: 'That code is incorrect or has expired.' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', data.user.id)
    .single();

  // Save the optional receipt email typed at sign-up (ignored if it is not a valid address).
  let contactEmail: string | null = null;
  try {
    contactEmail = parseEmail(formData.get('contactEmail'));
  } catch {
    contactEmail = null;
  }

  await supabase
    .from('profiles')
    .update({ last_login_at: new Date().toISOString(), ...(contactEmail ? { contact_email: contactEmail } : {}) })
    .eq('id', data.user.id);

  const destination = profile?.role === 'vendor' ? '/vendor/dashboard' : '/account/dashboard';
  redirect(`${destination}?toast=${encodeURIComponent(`Welcome, ${profile?.full_name ?? 'there'}!`)}`);
}