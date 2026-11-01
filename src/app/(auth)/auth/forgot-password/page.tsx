// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Turnstile, { TURNSTILE_ENABLED } from '@/components/ui/Turnstile';
import { CAPTCHA_MESSAGE, isCaptchaError } from '@/lib/captcha';
import { requestPhoneResetCode, verifyResetCode } from './actions';
import ProcessingButton from '@/components/ui/ProcessingButton';

const RESEND_SECONDS = 60;

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [codePhone, setCodePhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [resendToken, setResendToken] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const isEmail = identifier.includes('@');

  // Counts the "Resend code" wait down once per second.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    if (isEmail) {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(identifier.trim(), {
        redirectTo: `${window.location.origin}/auth/confirm?type=recovery`,
        captchaToken: captchaToken || undefined,
      });
      setLoading(false);
      if (resetError) {
        setError(isCaptchaError(resetError.message) ? CAPTCHA_MESSAGE : resetError.message);
        return;
      }
      setEmailSent(true);
      return;
    }

    const fd = new FormData();
    fd.set('phone', identifier);
    fd.set('captchaToken', captchaToken);
    const result = await requestPhoneResetCode(fd);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    if (result?.phone) {
      setCodePhone(result.phone);
      setCooldown(RESEND_SECONDS);
    }
  }

  async function handleVerify(formData: FormData) {
    setError(null);
    setNotice(null);
    const result = await verifyResetCode(formData); // redirects on success
    if (result?.error) setError(result.error);
  }

  async function handleResend(formData: FormData) {
    setError(null);
    setNotice(null);
    const result = await requestPhoneResetCode(formData);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setNotice('We sent a new code.');
    setCooldown(RESEND_SECONDS);
  }

  if (emailSent) {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-6 text-center">
        <h1 className="mb-2 font-serif text-2xl text-ink">Check your email</h1>
        <p className="text-sm text-ink-muted">
          If an account exists for <span className="font-medium text-ink">{identifier.trim()}</span>, we&rsquo;ve sent a
          link to reset your password.
        </p>
      </div>
    );
  }

  if (codePhone) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col justify-center px-6 py-16">
        <h1 className="mb-1 text-2xl font-semibold text-ink">Enter your code</h1>
        <p className="mb-6 text-sm text-ink-muted">
          If an account exists for {codePhone}, we&rsquo;ve sent it a 6-digit code by SMS.
        </p>

        {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {notice && <p className="mb-4 rounded-md bg-brand-green/10 px-3 py-2 text-sm text-brand-green">{notice}</p>}

        <form action={handleVerify} className="flex flex-col gap-4">
          <input type="hidden" name="phone" value={codePhone} />
          <label className="flex flex-col gap-1 text-sm">
            Verification code
            <input
              name="code"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              className="rounded-md border border-brand-sage px-3 py-2 text-center text-lg tracking-widest"
            />
          </label>
          <ProcessingButton type="submit" isProcessing={loading} processingText="Verifying…" className="rounded-md bg-brand-green px-4 py-2 font-medium text-white">
            Verify and choose a new password
          </ProcessingButton>
        </form>

        <form action={handleResend} className="mt-4 flex flex-col gap-2">
          <input type="hidden" name="phone" value={codePhone} />
          <Turnstile onToken={setResendToken} />
          <ProcessingButton
            type="submit"
            isProcessing={loading}
            processingText="Resending…"
            disabled={cooldown > 0 || (TURNSTILE_ENABLED && !resendToken)}
            className="self-start text-sm font-medium text-brand-green disabled:text-ink-muted"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </ProcessingButton>
        </form>

        <button
          type="button"
          onClick={() => {
            setCodePhone(null);
            setError(null);
            setNotice(null);
            setCaptchaToken('');
          }}
          className="mt-4 self-start text-sm text-ink-muted hover:text-brand-green"
        >
          Wrong number? Start again
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col justify-center px-6 py-16">
      <h1 className="mb-1 text-2xl font-semibold text-ink">Reset your password</h1>
      <p className="mb-6 text-sm text-ink-muted">
        Enter the phone number or email on your account. We&rsquo;ll text you a code, or email you a link.
      </p>

      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Phone number or email
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="024 123 4567 or john.doe@example.com"
            autoComplete="username"
            required
            className="rounded-md border border-brand-sage px-3 py-2"
          />
        </label>

        <Turnstile onToken={setCaptchaToken} />

        <ProcessingButton
          type="submit"
          isProcessing={loading}
          processingText="Sending…"
          disabled={TURNSTILE_ENABLED && !captchaToken}
          className="mt-2 rounded-md bg-brand-green px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {isEmail ? 'Send reset link' : 'Send code'}
        </ProcessingButton>
      </form>

      <p className="mt-6 text-sm text-ink-muted">
        <Link href="/auth/login" className="font-medium text-accent-terracotta">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}