// STRAYMUTANT.DEV — Tamak Bookshop
// Small helpers for Cloudflare Turnstile + Supabase CAPTCHA protection.
// Supabase checks the token itself (the Turnstile secret key lives in the
// Supabase dashboard, not in this app), so we only need to pass it along.

export const CAPTCHA_MESSAGE =
  'The security check did not finish. Please wait a moment and try again.';

/** The token the <Turnstile /> widget put in the form, or undefined if none. */
export function captchaTokenFrom(formData: FormData): string | undefined {
  const token = String(formData.get('captchaToken') ?? '').trim();
  return token || undefined;
}

/** True when a Supabase auth error is about the CAPTCHA, not the credentials. */
export function isCaptchaError(message?: string | null): boolean {
  return !!message && /captcha/i.test(message);
}