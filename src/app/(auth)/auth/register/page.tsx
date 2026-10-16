// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { registerClient, registerVendor, resendSignupCode, verifyPhoneCode } from './actions';
import PasswordInput from '@/components/ui/PasswordInput';
import PasswordStrengthMeter from '@/components/ui/PasswordStrengthMeter';
import Turnstile, { TURNSTILE_ENABLED } from '@/components/ui/Turnstile';

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const [accountType, setAccountType] = useState<'client' | 'vendor'>(
    searchParams.get('type') === 'vendor' ? 'vendor' : 'client'
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verifyPhone, setVerifyPhone] = useState<string | null>(null);
  const [verifyEmail, setVerifyEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState('');
  const [resendToken, setResendToken] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  // Counts the "Resend code" wait down once per second.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function handleSubmit(formData: FormData) {
    const action = accountType === 'client' ? registerClient : registerVendor;
    setError(null);
    const result = await action(formData);
    if (result?.error) {
      setError(result.error);
      return;
    }
    if (result?.phone) {
      setVerifyPhone(result.phone);
      setVerifyEmail(result.email ?? '');
      setCooldown(60);
    }
  }

  async function handleResend(formData: FormData) {
    setError(null);
    setNotice(null);
    const result = await resendSignupCode(formData);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setNotice('We sent a new code.');
    setCooldown(60);
  }

  async function handleVerify(formData: FormData) {
    setError(null);
    setNotice(null);
    const result = await verifyPhoneCode(formData); // redirects on success
    if (result?.error) setError(result.error);
  }

  if (verifyPhone) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col justify-center px-6 py-16">
        <h1 className="mb-1 text-2xl font-semibold text-ink">Verify your phone</h1>
        <p className="mb-6 text-sm text-ink-muted">
          We sent a 6-digit code by SMS to {verifyPhone}. Enter it below.
        </p>

        {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {notice && <p className="mb-4 rounded-md bg-brand-green/10 px-3 py-2 text-sm text-brand-green">{notice}</p>}

        <form action={handleVerify} className="flex flex-col gap-4">
          <input type="hidden" name="phone" value={verifyPhone} />
          <input type="hidden" name="contactEmail" value={verifyEmail} />
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
          <button type="submit" className="rounded-md bg-brand-green px-4 py-2 font-medium text-white">
            Verify and continue
          </button>
        </form>

        <form action={handleResend} className="mt-4 flex flex-col gap-2">
          <input type="hidden" name="phone" value={verifyPhone} />
          <Turnstile onToken={setResendToken} />
          <button
            type="submit"
            disabled={cooldown > 0 || (TURNSTILE_ENABLED && !resendToken)}
            className="self-start text-sm font-medium text-brand-green disabled:text-ink-muted"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setVerifyPhone(null);
            setError(null);
            setCaptchaToken('');
          }}
          className="mt-4 text-sm text-ink-muted hover:text-brand-green"
        >
          Wrong number or no code? Start again
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col justify-center px-6 py-16">
      <h1 className="mb-1 text-2xl font-semibold text-ink">Create an account</h1>
      <p className="mb-6 text-sm text-ink-muted">Tamak Bookshop</p>

      {searchParams.get('error') && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.get('error')}</p>
      )}

      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mb-6 flex rounded-md border border-brand-sage p-1">
        <button
          type="button"
          onClick={() => setAccountType('client')}
          className={`flex-1 rounded px-3 py-2 text-sm font-medium ${
            accountType === 'client' ? 'bg-brand-green text-white' : 'text-ink'
          }`}
        >
          Client
        </button>
        <button
          type="button"
          onClick={() => setAccountType('vendor')}
          className={`flex-1 rounded px-3 py-2 text-sm font-medium ${
            accountType === 'vendor' ? 'bg-brand-green text-white' : 'text-ink'
          }`}
        >
          Wholesale Vendor
        </button>
      </div>

      <form action={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Full name
          <input name="fullName" required placeholder="e.g. Ama Owusu" className="rounded-md border border-brand-sage px-3 py-2" />
        </label>

        {accountType === 'vendor' && (
          <label className="flex flex-col gap-1 text-sm">
            Business / School name
            <input
              name="businessName"
              required
              placeholder="e.g. St. Mary's JHS, or your shop name"
              className="rounded-md border border-brand-sage px-3 py-2"
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm">
          Phone number
          <input name="phone" type="tel" required placeholder="e.g. 024 123 4567" className="rounded-md border border-brand-sage px-3 py-2" />
          <span className="text-xs text-ink-muted">We&rsquo;ll text you a code to verify this number.</span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Email for receipts <span className="text-xs text-ink-muted">(optional)</span>
          <input name="contactEmail" type="email" placeholder="you@example.com" className="rounded-md border border-brand-sage px-3 py-2" />
          <span className="text-xs text-ink-muted">We email your receipt when you order and when your payment is confirmed.</span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Password
          <PasswordInput
            name="password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-brand-sage px-3 py-2"
          />
          <PasswordStrengthMeter password={password} />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Confirm password
          <PasswordInput
            required
            minLength={8}
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="rounded-md border border-brand-sage px-3 py-2"
          />
        </label>
        {passwordMismatch && <p className="text-xs text-red-700">Passwords do not match.</p>}

        <Turnstile onToken={setCaptchaToken} />

        <button
          type="submit"
          disabled={passwordMismatch || confirmPassword.length === 0 || (TURNSTILE_ENABLED && !captchaToken)}
          className="mt-2 rounded-md bg-brand-green px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {accountType === 'client' ? 'Send verification code' : 'Send code and submit for approval'}
        </button>

        {accountType === 'vendor' && (
          <p className="text-xs text-ink-muted">
            Wholesale accounts are reviewed by staff before credit access is granted.
          </p>
        )}
      </form>

      <p className="mt-6 text-sm text-ink-muted">
        Already have an account?{' '}
        <Link href="/auth/login" className="font-medium text-accent-terracotta">
          Log in
        </Link>
      </p>
    </div>
  );
}