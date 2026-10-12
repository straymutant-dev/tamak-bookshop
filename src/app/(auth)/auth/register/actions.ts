// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { createClient } from '@/lib/supabase/server';
import { CAPTCHA_MESSAGE, captchaTokenFrom, isCaptchaError } from '@/lib/captcha';

export async function registerClient(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const fullName = String(formData.get('fullName') ?? '');
  const phone = String(formData.get('phone') ?? '');

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, phone, role: 'client' },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm?type=signup`,
      captchaToken: captchaTokenFrom(formData),
    },
  });

  if (error || !data.user) {
    return { error: isCaptchaError(error?.message) ? CAPTCHA_MESSAGE : (error?.message ?? 'Registration failed') };
  }

  return { success: true };
}

export async function registerVendor(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const fullName = String(formData.get('fullName') ?? '');
  const phone = String(formData.get('phone') ?? '');
  const businessName = String(formData.get('businessName') ?? '');

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone,
        role: 'vendor',
        business_name: businessName,
        vendor_status: 'pending',
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm?type=signup`,
      captchaToken: captchaTokenFrom(formData),
    },
  });

  if (error || !data.user) {
    return { error: isCaptchaError(error?.message) ? CAPTCHA_MESSAGE : (error?.message ?? 'Registration failed') };
  }

  return { success: true };
}