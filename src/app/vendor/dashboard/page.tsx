// STRAYMUTANT.DEV — Tamak Bookshop
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatGHS } from '@/lib/currency';
import StatRow from '@/components/admin/StatRow';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending approval',
  approved: 'Approved',
  frozen: 'Frozen',
  rejected: 'Not approved',
};

export default async function VendorDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?redirectTo=/vendor/dashboard');

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_name, full_name, vendor_status, credit_limit_pesewas, outstanding_balance_pesewas')
    .eq('id', user.id)
    .single();

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, payment_status, total_pesewas, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const recentOrders = (orders ?? []).slice(0, 5);
  const available = Math.max(
    0,
    (profile?.credit_limit_pesewas ?? 0) - (profile?.outstanding_balance_pesewas ?? 0)
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-1 font-serif text-2xl text-ink">Welcome back, {profile?.full_name}</h1>
      <p className="mb-6 text-sm text-ink-muted">{profile?.business_name ?? 'Wholesale vendor account'}</p>


      {profile?.vendor_status !== 'approved' && (
        <div
          className={`mb-6 rounded-md px-4 py-3 text-sm ${
            profile?.vendor_status === 'pending'
              ? 'bg-accent-gold/10 text-accent-gold'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {profile?.vendor_status === 'pending'
            ? 'Your account is awaiting approval from Tamak Bookshop staff. You\u2019ll be notified once wholesale credit is enabled.'
            : 'Your wholesale account is not currently active. Contact Tamak Bookshop for details.'}
        </div>
      )}

      <StatRow
        stats={[
          { label: 'Status', value: STATUS_LABEL[profile?.vendor_status ?? 'pending'] },
          { label: 'Credit limit', value: formatGHS(profile?.credit_limit_pesewas ?? 0) },
          { label: 'Outstanding balance', value: formatGHS(profile?.outstanding_balance_pesewas ?? 0) },
          { label: 'Available credit', value: formatGHS(available), accent: 'green' },
          { label: 'Total orders', value: orders?.length ?? 0 },
        ]}
      />
      
      <div className="mb-8 rounded-md border border-border-beige bg-surface-card p-5">
        <h2 className="mb-2 text-sm font-medium text-ink-muted">Browse the catalog</h2>
        <p className="mb-3 text-sm text-ink-muted">
          {profile?.vendor_status === 'approved'
            ? 'Browse the catalog at your wholesale rate and check out on credit, or pay immediately.'
            : 'You can browse the catalog now — wholesale pricing and checkout unlock once your account is approved.'}
        </p>
        <Link href="/store" className="text-sm text-brand-green hover:underline">
          Browse books →
        </Link>
      </div>

      <div className="rounded-md border border-border-beige bg-surface-card p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-ink-muted">Recent orders</h2>
          <Link href="/account/orders" className="text-xs text-brand-green hover:underline">
            View all
          </Link>
        </div>

        <div className="flex flex-col gap-3">
          {(orders ?? []).map((order) => (
            <div key={order.id} className="flex items-center justify-between text-sm">
              <div>
                <div className="font-medium text-ink">{order.order_number}</div>
                <div className="text-xs capitalize text-ink-muted">{order.payment_status.replace('_', ' ')}</div>
              </div>
              <span className="text-ink">{formatGHS(order.total_pesewas)}</span>
            </div>
          ))}
          {(orders ?? []).length === 0 && (
            <p className="text-sm text-ink-muted">No orders yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}