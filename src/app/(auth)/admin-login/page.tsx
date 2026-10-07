// STRAYMUTANT.DEV — Tamak Bookshop
import PasswordInput from '@/components/ui/PasswordInput';
import { adminLogin } from './actions';

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="w-full max-w-sm px-6">
      <h1 className="mb-1 text-2xl font-semibold text-ink">Admin portal sign in</h1>
      <p className="mb-6 text-sm text-ink-muted">Staff and admin accounts only</p>

      {params.error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{params.error}</p>
      )}

      <form action={adminLogin} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input type="email" name="email" required className="rounded-md border border-brand-sage px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <PasswordInput name="password" required className="rounded-md border border-brand-sage px-3 py-2" />
        </label>
        <button type="submit" className="mt-2 rounded-md bg-brand-green px-4 py-2 font-medium text-white">
          Sign in
        </button>
      </form>
    </div>
  );
}