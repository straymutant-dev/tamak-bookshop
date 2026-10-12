// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Turnstile, { TURNSTILE_ENABLED } from '@/components/ui/Turnstile';
import { CAPTCHA_MESSAGE, isCaptchaError } from '@/lib/captcha';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?type=recovery`,
      captchaToken: captchaToken || undefined,
    });

    setLoading(false);
    if (resetError) {
      setError(isCaptchaError(resetError.message) ? CAPTCHA_MESSAGE : resetError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-6 text-center">
        <h1 className="mb-2 font-serif text-2xl text-ink">Check your email</h1>
        <p className="text-sm text-ink-muted">
          If an account exists for <span className="font-medium text-ink">{email}</span>, we&rsquo;ve sent a
          link to reset your password.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col justify-center px-6 py-16">
      <h1 className="mb-1 text-2xl font-semibold text-ink">Reset your password</h1>
      <p className="mb-6 text-sm text-ink-muted">
        Enter the email on your account and we&rsquo;ll send you a link to reset your password.
      </p>

      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="john.doe@example.com"
            required
            className="rounded-md border border-brand-sage px-3 py-2"
          />
        </label>

        <Turnstile onToken={setCaptchaToken} />

        <button
          type="submit"
          disabled={loading || (TURNSTILE_ENABLED && !captchaToken)}
          className="mt-2 rounded-md bg-brand-green px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink-muted">
        <Link href="/auth/login" className="font-medium text-accent-terracotta">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}