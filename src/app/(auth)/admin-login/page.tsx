// STRAYMUTANT.DEV — Tamak Bookshop
import type { Metadata } from 'next';
import PasswordInput from '@/components/ui/PasswordInput';
import { adminLogin } from './actions';
import Turnstile from '@/components/ui/Turnstile';
import ProcessingButton from '@/components/ui/ProcessingButton';

export const metadata: Metadata = {
  title: 'Staff login',
  robots: { index: false, follow: false },
};

const INPUT_CLASS =
  'rounded-xl border border-brand-sage bg-surface-card px-3.5 py-3 text-sm text-ink outline-none focus:border-brand-green';

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="w-full max-w-md px-6">
      <div className="auth-card rounded-2xl border border-border-beige px-8 py-10">
        <h1 className="mb-1 font-serif text-3xl text-brand-green">Admin portal sign in</h1>
        <p className="mb-6 text-sm text-ink-muted">Staff and admin accounts only</p>

        {params.error && (
          <p className="mb-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{params.error}</p>
        )}

        <form action={adminLogin} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            Email
            <input type="email" name="email" required className={`${INPUT_CLASS} font-normal`} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            Password
            <PasswordInput name="password" required className={`${INPUT_CLASS} font-normal`} />
          </label>
          <Turnstile />
          <ProcessingButton type="submit" processingText="Signing in…" className="mt-2 rounded-xl bg-brand-green px-4 py-3 font-medium text-white">
            Sign in
          </ProcessingButton>
        </form>
      </div>
    </div>
  );
}