// STRAYMUTANT.DEV — Tamak Bookshop
import Link from 'next/link';
import { login } from './actions';
import PasswordInput from '@/components/ui/PasswordInput';
import Turnstile from '@/components/ui/Turnstile';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string; unauthorized?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col justify-center px-6 py-16">
      <h1 className="mb-1 text-2xl font-semibold text-ink">Sign in</h1>
      <p className="mb-6 text-sm text-ink-muted">Tamak Bookshop account access</p>

      {params.error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{params.error}</p>
      )}

      {params.unauthorized === '1' && !params.error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          You don&rsquo;t have permission to view that page. Please sign in with an authorized account.
        </p>
      )}

      <form action={login} className="flex flex-col gap-4">
        <input type="hidden" name="redirectTo" value={params.redirectTo ?? ''} />

        <label className="flex flex-col gap-1 text-sm">
          Email
          <input type="email" name="email" placeholder='john.doe@example.com' required className="rounded-md border border-brand-sage px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Password
          <PasswordInput name="password" placeholder='••••••••' required className="rounded-md border border-brand-sage px-3 py-2" />
        </label>

        <Link href="/auth/forgot-password" className="-mt-2 self-end text-xs font-medium text-brand-green hover:underline">
          Forgot password?
        </Link>

        <Turnstile />

        <button type="submit" className="mt-2 rounded-md bg-brand-green px-4 py-2 font-medium text-white">
          Sign in
        </button>
      </form>

      <p className="mt-6 text-sm text-ink-muted">
        No account?{' '}
        <Link href="/auth/register" className="font-medium text-accent-terracotta">
          Register
        </Link>
      </p>
    </div>
  );
}