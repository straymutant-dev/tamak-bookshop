// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { registerClient, registerVendor, verifyPhoneCode } from './actions';
import PasswordInput from '@/components/ui/PasswordInput';
import OtpInput from '@/components/ui/OtpInput';
import PasswordStrengthMeter from '@/components/ui/PasswordStrengthMeter';
import HCaptcha, { HCAPTCHA_ENABLED } from '@/components/ui/HCaptcha';
import ProcessingButton from '@/components/ui/ProcessingButton';
import LegalDocumentModal from '@/components/ui/LegalDocumentModal';
import CheckEmailNotice from '@/components/ui/CheckEmailNotice';

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const [accountType, setAccountType] = useState<'client' | 'vendor'>(
    searchParams.get('type') === 'vendor' ? 'vendor' : 'client'
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [verifyPhone, setVerifyPhone] = useState<string | null>(null);
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState('');
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const isEmail = identifier.includes('@');

  async function handleSubmit(formData: FormData) {
    const action = accountType === 'client' ? registerClient : registerVendor;
    setError(null);
    const result = await action(formData);
    if (result?.error) {
      setError(result.error);
      return;
    }
    if (result?.phone) setVerifyPhone(result.phone);
    if (result?.email) setVerifyEmail(result.email);
  }

  async function handleVerify(formData: FormData) {
    setError(null);
    const result = await verifyPhoneCode(formData); // redirects on success
    if (result?.error) setError(result.error);
  }

  if (verifyPhone) {
    return (
      <div className="auth-card register-card mx-auto flex w-full max-w-sm flex-col justify-center rounded-2xl border border-border-beige px-7 py-9">
        <h1 className="mb-1 text-2xl font-semibold text-ink">Verify your phone</h1>
        <p className="mb-6 text-sm text-ink-muted">
          We sent a 6-digit code by SMS to {verifyPhone}. Enter it below.
        </p>

        {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <form action={handleVerify} className="flex flex-col gap-4">
          <input type="hidden" name="phone" value={verifyPhone} />
          <div className="flex flex-col gap-2 text-sm">
            <span>Verification code</span>
            <OtpInput name="code" error={Boolean(error)} />
          </div>
          <ProcessingButton type="submit" processingText="Verifying…" className="rounded-md bg-brand-green px-4 py-2 font-medium text-white">
            Verify and continue
          </ProcessingButton>
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

  if (verifyEmail) {
    return <CheckEmailNotice email={verifyEmail} vendor={accountType === 'vendor'} />;
  }

  return (
    <div className="auth-card register-card mx-auto my-12 flex w-full max-w-sm flex-col justify-center rounded-2xl border border-border-beige px-7 py-9">
      <h1 className="mb-1 text-2xl font-semibold text-ink">Create an account</h1>
      <p className="register-card__subtitle mb-6 text-sm text-ink-muted">Tamak Bookshop</p>

      {searchParams.get('error') && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.get('error')}</p>
      )}

      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="register-card__tabs mb-6 flex rounded-md border border-brand-sage p-1">
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
          Phone number or email
          <input
            name="identifier"
            type="text"
            required
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            autoComplete="username"
            placeholder="024 123 4567 or name@example.com"
            className="rounded-md border border-brand-sage px-3 py-2"
          />
          <span className="text-xs text-ink-muted">
            {isEmail ? 'We’ll email you a confirmation link.' : 'We’ll text you a code to verify your number.'}
          </span>
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

        <input type="hidden" name="acceptedLegal" value={acceptedLegal ? 'true' : 'false'} />
        <div className="flex items-start gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={acceptedLegal}
            onChange={(event) => setAcceptedLegal(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-green"
          />
          <span>
            I agree to the{' '}
            <LegalDocumentModal label="Terms of Sale" title="Terms of Sale" href="/terms" className="font-medium text-brand-green hover:underline" />
            {' '}and{' '}
            <LegalDocumentModal label="Privacy Policy" title="Privacy Policy" href="/privacy" className="font-medium text-brand-green hover:underline" />.
          </span>
        </div>

        <HCaptcha onToken={setCaptchaToken} />

        <ProcessingButton
          type="submit"
          processingText="Sending code…"
          disabled={!acceptedLegal || passwordMismatch || confirmPassword.length === 0 || (HCAPTCHA_ENABLED && !captchaToken)}
          className="mt-2 rounded-md bg-brand-green px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {isEmail
            ? 'Send confirmation email'
            : accountType === 'client'
              ? 'Send verification code'
              : 'Send code and submit for approval'}
        </ProcessingButton>

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