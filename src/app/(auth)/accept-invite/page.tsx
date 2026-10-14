// STRAYMUTANT.DEV — Tamak Bookshop
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PasswordInput from '@/components/ui/PasswordInput';
import { setPassword } from './actions';

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/invite-expired');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, invite_accepted_at')
    .eq('id', user.id)
    .single();

  // only invited staff/admin belong here, and only until they've set a password
  if (profile?.role !== 'staff' && profile?.role !== 'admin') redirect('/invite-expired');
  if (profile.invite_accepted_at) redirect('/admin/dashboard');

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col justify-center px-6 py-16">
      <h1 className="mb-1 text-2xl font-semibold text-ink">Welcome to Tamak Bookshop</h1>
      <p className="mb-6 text-sm text-ink-muted">
        Confirm your details and choose a password to finish setting up your {profile.role} account.
      </p>

      {params.error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{params.error}</p>
      )}

      <form action={setPassword} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Full name
          <input
            value={profile.full_name}
            disabled
            readOnly
            className="rounded-md border border-brand-sage bg-surface-cream px-3 py-2 text-ink-muted"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            value={user.email ?? ''}
            disabled
            readOnly
            className="rounded-md border border-brand-sage bg-surface-cream px-3 py-2 text-ink-muted"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          New password
          <PasswordInput
            name="password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            className="rounded-md border border-brand-sage px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Confirm new password
          <PasswordInput
            name="confirm"
            required
            minLength={8}
            placeholder="Re-enter your password"
            className="rounded-md border border-brand-sage px-3 py-2"
          />
        </label>

        <button type="submit" className="mt-2 rounded-md bg-brand-green px-4 py-2 font-medium text-white">
          Set password and continue
        </button>
      </form>
    </div>
  );
}