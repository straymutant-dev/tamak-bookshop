// STRAYMUTANT.DEV — Tamak Bookshop
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatGHS } from '@/lib/currency';
import StatRow, { type Stat } from '@/components/admin/StatRow';
import SalesTrend, { type SalesTrendPoint } from '@/components/admin/SalesTrend';
import OrderNumberButton from '@/components/orders/OrderNumberButton';
import NeedsAttention from '@/components/admin/NeedsAttention';
import { AlertTriangle, BookOpen, Receipt, UserCheck } from 'lucide-react';
import { orderStatusLabel } from '@/lib/orderStatus';

const PAYMENT_LABEL: Record<string, string> = {
  paid: 'Paid',
  payment_pending: 'Awaiting payment',
  credit_pending: 'Credit review',
  credit_approved: 'On credit',
  partially_paid: 'Part paid',
};

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user!.id)
    .single();

  const isAdmin = profile?.role === 'admin';

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const trendStart = new Date(Date.UTC(todayStart.getUTCFullYear(), todayStart.getUTCMonth() - 11, 1));
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

  const trendOrdersPromise = (async () => {
    const rows: { total_pesewas: number; created_at: string }[] = [];
    const pageSize = 1000;

    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from('orders')
        .select('total_pesewas, created_at')
        .gte('created_at', trendStart.toISOString())
        .lt('created_at', tomorrowStart.toISOString())
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) return { data: null, error };
      rows.push(...(data ?? []));
      if (!data || data.length < pageSize) return { data: rows, error: null };
    }
  })();

  const [
    { count: activeBooksCount },
    { data: lowStockCount },
    { data: trendOrders, error: trendError },
    { count: pendingVendorCount },
    { data: recentOrders, error: recentOrdersError },
  ] =
    await Promise.all([
      supabase.from('books').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.rpc('low_stock_count'),
      trendOrdersPromise,
      isAdmin
        ? supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'vendor').eq('vendor_status', 'pending')
        : Promise.resolve({ count: 0 }),
      supabase
        .from('orders')
        .select(
          'id, order_number, order_type, contact_name, user_id, staff_id, total_pesewas, created_at, order_status, payment_status, fulfillment_type'
        )
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

  const trendByDate = new Map<string, SalesTrendPoint>();
  for (let day = new Date(trendStart); day < tomorrowStart; day.setUTCDate(day.getUTCDate() + 1)) {
    const date = day.toISOString().slice(0, 10);
    trendByDate.set(date, { date, totalPesewas: 0, orderCount: 0 });
  }
  for (const order of trendOrders ?? []) {
    const date = order.created_at.slice(0, 10);
    const point = trendByDate.get(date);
    if (point) {
      point.totalPesewas += order.total_pesewas;
      point.orderCount += 1;
    }
  }
  const salesTrend = Array.from(trendByDate.values());
  const todaysSalesTotal = trendByDate.get(todayStart.toISOString().slice(0, 10))?.totalPesewas ?? 0;

  const recentProfileIds = Array.from(
    new Set((recentOrders ?? []).flatMap((order) => [order.staff_id, order.user_id]).filter((id): id is string => Boolean(id)))
  );
  const namesById: Record<string, string> = {};
  if (recentProfileIds.length > 0) {
    const { data: recentProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, business_name')
      .in('id', recentProfileIds);
    for (const p of recentProfiles ?? []) namesById[p.id] = p.business_name || p.full_name || 'Customer';
  }

  const stats: Stat[] = [
    { label: "Today's sales", value: formatGHS(todaysSalesTotal), accent: 'green', icon: <Receipt size={18} /> },
    { label: 'Active books', value: activeBooksCount ?? 0, icon: <BookOpen size={18} /> },
    {
      label: 'Low stock',
      value: lowStockCount ?? 0,
      accent: (lowStockCount ?? 0) > 0 ? 'terracotta' : undefined,
      icon: <AlertTriangle size={18} />,
    },
  ];
  if (isAdmin) {
    stats.push({
      label: 'Pending vendors',
      value: pendingVendorCount ?? 0,
      accent: (pendingVendorCount ?? 0) > 0 ? 'gold' : undefined,
      icon: <UserCheck size={18} />,
    });
  }

  return (
    <div>
      <h1 className="mb-1 font-serif text-2xl text-ink">Welcome back, {profile?.full_name}</h1>
      <p className="mb-6 text-sm text-ink-muted">Here&rsquo;s what&rsquo;s happening today.</p>

      <StatRow stats={stats} />

      {trendError && (
        <p className="mb-8 rounded-xl border border-accent-terracotta/30 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load sales trend: {trendError.message}
        </p>
      )}
      {!trendError && <SalesTrend points={salesTrend} />}

      <NeedsAttention isAdmin={isAdmin} />

      <div className="mb-8 flex flex-wrap gap-3">
        <Link href="/admin/pos" className="rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white">
          Go to POS
        </Link>
        {isAdmin && (
          <Link href="/admin/inventory" className="rounded-md border border-brand-sage px-4 py-2 text-sm text-ink">
            Add a book
          </Link>
        )}
        {isAdmin && (pendingVendorCount ?? 0) > 0 && (
          <Link href="/admin/vendors" className="rounded-md border border-accent-gold px-4 py-2 text-sm text-accent-gold">
            Review pending vendors
          </Link>
        )}
      </div>

      <section className="overflow-hidden rounded-2xl border border-border-beige bg-surface-card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-serif text-xl text-ink">Recent orders</h2>
            <p className="mt-1 text-sm text-ink-muted">Latest orders across the shop</p>
          </div>
          <Link href="/admin/orders" className="text-sm font-medium text-brand-green hover:underline">
            View all
          </Link>
        </div>

        {recentOrdersError ? (
          <p className="border-t border-border-beige px-5 py-4 text-sm text-red-700">
            Failed to load recent orders: {recentOrdersError.message}
          </p>
        ) : (recentOrders ?? []).length === 0 ? (
          <p className="border-t border-border-beige px-5 py-6 text-sm text-ink-muted">No orders yet.</p>
        ) : (
          <ul aria-label="Recent orders" className="divide-y divide-border-beige border-t border-border-beige">
            {(recentOrders ?? []).map((order) => {
              const customer = order.user_id
                ? namesById[order.user_id] ?? 'Registered customer'
                : order.contact_name || 'Guest checkout';
              const orderType =
                order.order_type === 'counter_pos'
                  ? 'Counter sale'
                  : order.order_type === 'storefront_vendor'
                    ? 'Wholesale'
                    : 'Online';
              const paymentLabel = PAYMENT_LABEL[order.payment_status] ?? order.payment_status;

              return (
                <li key={order.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:px-6">
                  <div className="min-w-0">
                    <OrderNumberButton orderId={order.id} orderNumber={order.order_number} />
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {new Date(order.created_at).toLocaleDateString('en-GH', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        timeZone: 'UTC',
                      })}
                      {' · '}
                      {orderType}
                    </p>
                  </div>
                  <p className="min-w-0 truncate text-right text-sm text-ink-muted sm:text-left" title={customer}>
                    {customer}
                  </p>
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-surface-cream px-2.5 py-1 text-xs text-ink-muted">
                      {orderStatusLabel(order.order_status, order.fulfillment_type)}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs ${
                        order.payment_status === 'paid' || order.payment_status === 'credit_approved'
                          ? 'bg-brand-green/10 text-brand-green'
                          : 'bg-accent-gold/15 text-ink'
                      }`}
                    >
                      {paymentLabel}
                    </span>
                  </div>
                  <span className="text-right text-sm font-semibold text-ink">{formatGHS(order.total_pesewas)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}