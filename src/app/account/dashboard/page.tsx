// STRAYMUTANT.DEV — Tamak Bookshop
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatGHS } from '@/lib/currency';
import StatRow from '@/components/admin/StatRow';
import OrderNumberButton from '@/components/orders/OrderNumberButton';
import NotificationsPanel from '@/components/notifications/NotificationsPanel';

export default async function ClientDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?redirectTo=/account/dashboard');

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, payment_status, total_pesewas, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const recentOrders = (orders ?? []).slice(0, 5);
  const lastOrderDate = orders?.[0]?.created_at;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-1 font-serif text-2xl text-ink">Welcome back, {profile?.full_name}</h1>
      <p className="mb-6 text-sm text-ink-muted">Here&rsquo;s your account at a glance.</p>

      <NotificationsPanel />

      <StatRow
        stats={[
          { label: 'Total orders', value: orders?.length ?? 0 },
          {
            label: 'Last order',
            value: lastOrderDate ? new Date(lastOrderDate).toLocaleDateString() : 'None yet',
          },
        ]}
      />

      <div className="mb-8 flex flex-wrap gap-3">
        <Link href="/store" className="rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white">
          Browse the catalog
        </Link>
        <Link href="/store/track" className="rounded-md border border-brand-sage px-4 py-2 text-sm text-ink">
          Track an order
        </Link>
        <Link href="/account/settings" className="rounded-md border border-brand-sage px-4 py-2 text-sm text-ink">
          Account settings
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
          {recentOrders.map((order) => (
            <div key={order.id} className="flex items-center justify-between text-sm">
              <div>
                <OrderNumberButton orderId={order.id} orderNumber={order.order_number} />
                <div className="text-xs capitalize text-ink-muted">{order.payment_status.replace('_', ' ')}</div>
              </div>
              <span className="text-ink">{formatGHS(order.total_pesewas)}</span>
            </div>
          ))}
          {recentOrders.length === 0 && (
            <p className="text-sm text-ink-muted">
              No orders yet —{' '}
              <Link href="/store" className="text-brand-green hover:underline">
                start browsing
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </div>
  );
}