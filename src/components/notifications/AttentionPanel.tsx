// STRAYMUTANT.DEV — Tamak Bookshop
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

const LOW_STOCK_THRESHOLD = 5;

/**
 * "Needs your attention" for staff and admins. These are counted live from the
 * data, so they are always accurate and disappear as soon as the work is done.
 */
export default async function AttentionPanel() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const isAdmin = me?.role === 'admin';

  const [vendorOrders, repayments, vendors, chequesWaiting, tellCustomers, lowStock] = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('order_type', 'storefront_vendor')
      .in('payment_status', ['credit_pending', 'payment_pending']),
    supabase.from('repayment_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    isAdmin
      ? supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'vendor')
          .eq('vendor_status', 'pending')
      : Promise.resolve({ count: 0 }),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('order_type', 'counter_pos')
      .is('user_id', null)
      .eq('payment_status', 'credit_approved')
      .not('cheque_number', 'is', null),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('order_type', 'counter_pos')
      .is('user_id', null)
      .eq('payment_method', 'cheque')
      .eq('payment_status', 'paid')
      .is('customer_notified_at', null),
    isAdmin
      ? supabase
          .from('books')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .lte('stock_quantity', LOW_STOCK_THRESHOLD)
      : Promise.resolve({ count: 0 }),
  ]);

  const rows = [
    { label: 'Vendor orders to approve or confirm', count: vendorOrders.count ?? 0, href: '/admin/orders?tab=vendor' },
    { label: 'Vendor payments to confirm', count: repayments.count ?? 0, href: '/admin/repayments' },
    { label: 'Vendors waiting for approval', count: vendors.count ?? 0, href: '/admin/vendors' },
    { label: 'Walk-in cheques waiting to clear', count: chequesWaiting.count ?? 0, href: '/admin/orders?tab=walkin' },
    { label: 'Walk-in customers to tell their cheque cleared', count: tellCustomers.count ?? 0, href: '/admin/orders?tab=walkin' },
    { label: 'Books running low', count: lowStock.count ?? 0, href: '/admin/inventory' },
  ].filter((r) => r.count > 0);

  return (
    <div className="mb-8 rounded-md border border-border-beige bg-surface-card p-5">
      <h2 className="mb-4 text-sm font-medium text-ink-muted">Needs your attention</h2>

      {rows.length === 0 ? (
        <p className="text-sm text-brand-green">You&rsquo;re all caught up.</p>
      ) : (
        <div className="flex flex-col">
          {rows.map((r) => (
            <Link
              key={r.label}
              href={r.href}
              className="flex items-center justify-between border-t border-border-beige py-3 text-sm first:border-t-0 first:pt-0 hover:text-brand-green"
            >
              <span className="text-ink">{r.label}</span>
              <span className="rounded-full bg-accent-terracotta px-2.5 py-0.5 text-xs font-medium text-white">
                {r.count}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}