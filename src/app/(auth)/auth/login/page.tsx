// STRAYMUTANT.DEV — Tamak Bookshop
import Link from 'next/link';
import { login } from './actions';
import PasswordInput from '@/components/ui/PasswordInput';
import HCaptcha from '@/components/ui/HCaptcha';
import ProcessingButton from '@/components/ui/ProcessingButton';

const INPUT_CLASS =
  'rounded-xl border border-brand-sage bg-surface-card px-3.5 py-3 text-sm text-ink outline-none focus:border-brand-green';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string; unauthorized?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="mx-auto w-full max-w-md px-6 py-12">
      <div className="auth-card rounded-2xl border border-border-beige px-8 py-10">
        <h1 className="mb-1 font-serif text-3xl text-brand-green">Sign in</h1>
        <p className="mb-6 text-sm text-ink-muted">Tamak Bookshop account access</p>

        {params.error && (
          <p className="mb-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{params.error}</p>
        )}

        {params.unauthorized === '1' && !params.error && (
          <p className="mb-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            You don&rsquo;t have permission to view that page. Please sign in with an authorized account.
          </p>
        )}

        <form action={login} className="flex flex-col gap-4">
          <input type="hidden" name="redirectTo" value={params.redirectTo ?? ''} />

          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            Phone number or email
            <input
              type="text"
              name="identifier"
              placeholder="024 123 4567 or you@example.com"
              required
              autoComplete="username"
              className={`${INPUT_CLASS} font-normal`}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            Password
            <PasswordInput name="password" placeholder="••••••••" required className={`${INPUT_CLASS} font-normal`} />
          </label>

          <Link href="/auth/forgot-password" className="-mt-2 self-end text-xs font-medium text-brand-green hover:underline">
            Forgot password?
          </Link>

          <HCaptcha />

          <ProcessingButton type="submit" processingText="Signing in…" className="mt-2 rounded-xl bg-brand-green px-4 py-3 font-medium text-white">
            Sign in
          </ProcessingButton>
        </form>

        <p className="mt-6 text-sm text-ink-muted">
          No account?{' '}
          <Link href="/auth/register" className="font-medium text-accent-terracotta">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}