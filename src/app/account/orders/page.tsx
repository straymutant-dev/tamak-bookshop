// STRAYMUTANT.DEV — Tamak Bookshop
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatGHS } from '@/lib/currency';
import { orderStatusLabel } from '@/lib/orderStatus';
import OrderNumberButton from '@/components/orders/OrderNumberButton';

const PAYMENT_LABEL: Record<string, string> = {
  paid: 'Paid',
  payment_pending: 'Awaiting payment confirmation',
  credit_pending: 'Credit — awaiting approval',
  credit_approved: 'On credit account',
  partially_paid: 'Part paid',
};

const DASHBOARD_BY_ROLE: Record<string, string> = {
  vendor: '/vendor/dashboard',
  client: '/account/dashboard',
  staff: '/admin/dashboard',
  admin: '/admin/dashboard',
};

export default async function AccountOrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?redirectTo=/account/orders');

  const [{ data: profile }, { data: orders, error }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase
      .from('orders')
      .select(
        'id, order_number, order_type, payment_method, payment_status, total_pesewas, discount_pesewas, fulfillment_type, order_status, created_at'
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ]);

  const dashboardHref = DASHBOARD_BY_ROLE[profile?.role ?? 'client'] ?? '/account/dashboard';

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href={dashboardHref} className="mb-6 inline-block text-sm text-ink-muted hover:text-brand-green">
        ← Back to dashboard
      </Link>

      <h1 className="mb-6 font-serif text-2xl text-ink">Your orders</h1>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load orders: {error.message}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {(orders ?? []).map((order) => (
          <div key={order.id} className="flex items-center justify-between rounded-md border border-border-beige bg-surface-card p-4 text-sm">
            <div>
              <OrderNumberButton orderId={order.id} orderNumber={order.order_number} />
              <p className="text-xs capitalize text-ink-muted">
                {orderStatusLabel(order.order_status, order.fulfillment_type)} · {order.fulfillment_type}
              </p>
              <p className="text-xs text-ink-muted">{PAYMENT_LABEL[order.payment_status] ?? order.payment_status}</p>
            </div>
            <span className="text-ink">{formatGHS(order.total_pesewas)}</span>
          </div>
        ))}
        {(orders ?? []).length === 0 && !error && (
          <p className="text-sm text-ink-muted">No orders yet.</p>
        )}
      </div>
    </div>
  );
}