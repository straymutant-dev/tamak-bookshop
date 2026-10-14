// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CAPTCHA_MESSAGE, captchaTokenFrom, isCaptchaError } from '@/lib/captcha';
import { normalizeGhanaPhone, toE164 } from '@/lib/phone';

const PHONE_ERROR = 'Enter a valid Ghana phone number, e.g. 024 123 4567.';

async function startRegistration(formData: FormData, role: 'client' | 'vendor') {
  const password = String(formData.get('password') ?? '');
  const fullName = String(formData.get('fullName') ?? '').trim();
  const businessName = String(formData.get('businessName') ?? '').trim();
  const rawPhone = String(formData.get('phone') ?? '');

  const e164 = toE164(rawPhone);
  const local = normalizeGhanaPhone(rawPhone);
  if (!e164 || !local) return { error: PHONE_ERROR };

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
    return { error: isCaptchaError(error?.message) ? CAPTCHA_MESSAGE : (error?.message ?? 'Registration failed') };
  }

  return { success: true, phone: e164 };
}

export async function registerClient(formData: FormData) {
  return startRegistration(formData, 'client');
}

export async function registerVendor(formData: FormData) {
  return startRegistration(formData, 'vendor');
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

  await supabase.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', data.user.id);

  const destination = profile?.role === 'vendor' ? '/vendor/dashboard' : '/account/dashboard';
  redirect(`${destination}?toast=${encodeURIComponent(`Welcome, ${profile?.full_name ?? 'there'}!`)}`);
}