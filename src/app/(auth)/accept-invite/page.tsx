// STRAYMUTANT.DEV — Tamak Bookshop
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PasswordInput from '@/components/ui/PasswordInput';
import { setPassword } from './actions';
import ProcessingButton from '@/components/ui/ProcessingButton';

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

  if (!profile || !['client', 'vendor', 'staff', 'admin'].includes(profile.role)) {
    redirect('/invite-expired');
  }
  if (profile.invite_accepted_at) {
    if (profile.role === 'vendor') redirect('/vendor/dashboard');
    if (profile.role === 'client') redirect('/account/dashboard');
    redirect('/admin/dashboard');
  }

  return (
    <div className="mx-auto my-12 w-full max-w-md px-6">
      <div className="auth-card rounded-2xl border border-border-beige px-7 py-9 sm:px-8 sm:py-10">
        <h1 className="mb-1 font-serif text-3xl text-brand-green">Welcome to Tamak Bookshop</h1>
        <p className="mb-6 text-sm text-ink-muted">
          Confirm your details and choose a password to finish setting up your {profile.role} account.
        </p>

        {params.error && (
          <p className="mb-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{params.error}</p>
        )}

        <form action={setPassword} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            Full name
            <input
              value={profile.full_name}
              disabled
              readOnly
              className="rounded-xl border border-brand-sage bg-surface-cream px-3.5 py-3 text-sm font-normal text-ink-muted"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            Email
            <input
              value={user.email ?? ''}
              disabled
              readOnly
              className="rounded-xl border border-brand-sage bg-surface-cream px-3.5 py-3 text-sm font-normal text-ink-muted"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            New password
            <PasswordInput
              name="password"
              required
              minLength={8}
              placeholder="At least 8 characters"
              className="rounded-xl border border-brand-sage bg-surface-card px-3.5 py-3 text-sm font-normal text-ink outline-none focus:border-brand-green"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            Confirm new password
            <PasswordInput
              name="confirm"
              required
              minLength={8}
              placeholder="Re-enter your password"
              className="rounded-xl border border-brand-sage bg-surface-card px-3.5 py-3 text-sm font-normal text-ink outline-none focus:border-brand-green"
            />
          </label>

          <ProcessingButton type="submit" processingText="Setting password…" className="mt-2 rounded-xl bg-brand-green px-4 py-3 font-medium text-white">
            Set password and continue
          </ProcessingButton>
        </form>
      </div>
    </div>
  );
}