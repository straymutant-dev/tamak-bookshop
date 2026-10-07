// STRAYMUTANT.DEV — Tamak Bookshop
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatGHS } from '@/lib/currency';
import BrandMark from '@/components/store/BrandMark';
import BackButton from './BackButton';
import ProfileForm from './ProfileForm';
import PasswordForm from './PasswordForm';
import SignOutButton from './SignOutButton';

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login?redirectTo=/account/settings');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone, role, credit_limit_pesewas, outstanding_balance_pesewas')
    .eq('id', user.id)
    .single();

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">

        <BackButton fallbackHref={profile?.role === 'admin' ? '/admin/inventory' : '/store'} />
        
        <h1 className="mb-8 font-serif text-3xl text-ink">Account settings</h1>

        <div className="grid gap-6 sm:grid-cols-2">
          <section className="rounded-md border border-border-beige bg-surface-card p-6 sm:col-span-2">
            <h2 className="mb-4 text-sm font-medium text-ink-muted">Profile</h2>

            <div className="mb-4 flex flex-col gap-1 text-sm">
              <span className="text-ink">Email</span>
              <div className="flex items-center justify-between rounded-md border border-border-beige bg-surface-cream px-3 py-2">
                <span className="text-ink-muted">{user.email}</span>
                <span className="text-xs text-ink-muted">Verified — cannot be changed here</span>
              </div>
            </div>

            <ProfileForm fullName={profile?.full_name ?? ''} phone={profile?.phone ?? ''} />
          </section>

          <section className="rounded-md border border-border-beige bg-surface-card p-6 sm:col-span-2">
            <h2 className="mb-4 text-sm font-medium text-ink-muted">Password</h2>
            <PasswordForm />
          </section>

          {profile?.role === 'client' && (
            <section className="rounded-md border border-border-beige bg-surface-card p-6">
              <h2 className="mb-2 text-sm font-medium text-ink-muted">Orders</h2>
              <a href="/account/orders" className="text-sm text-brand-green hover:underline">
                View your order history
              </a>
            </section>
          )}

          {profile?.role === 'vendor' && (
            <section className="rounded-md border border-border-beige bg-surface-card p-6">
              <h2 className="mb-4 text-sm font-medium text-ink-muted">Wholesale credit</h2>
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted">Credit limit</span>
                <span className="text-ink">{formatGHS(profile.credit_limit_pesewas ?? 0)}</span>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-ink-muted">Outstanding balance</span>
                <span className="text-ink">{formatGHS(profile.outstanding_balance_pesewas ?? 0)}</span>
              </div>
            </section>
          )}

          <section className="rounded-md border border-border-beige bg-surface-card p-6 sm:col-span-2">
            <SignOutButton />
          </section>
        </div>
      </div>
  );
}