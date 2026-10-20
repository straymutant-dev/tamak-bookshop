// STRAYMUTANT.DEV — Tamak Bookshop
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatGHS } from '@/lib/currency';
import StatRow, { type Stat } from '@/components/admin/StatRow';
import OrderNumberButton from '@/components/orders/OrderNumberButton';
import NeedsAttention from '@/components/admin/NeedsAttention';
import { AlertTriangle, BookOpen, Receipt, UserCheck } from 'lucide-react';

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
  todayStart.setHours(0, 0, 0, 0);

  const [{ count: activeBooksCount }, { data: lowStockCount }, { data: todaysOrders }, { count: pendingVendorCount }, { data: recentOrders }] =
    await Promise.all([
      supabase.from('books').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.rpc('low_stock_count'),
      supabase.from('orders').select('total_pesewas').gte('created_at', todayStart.toISOString()),
      isAdmin
        ? supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'vendor').eq('vendor_status', 'pending')
        : Promise.resolve({ count: 0 }),
      supabase
        .from('orders')
        .select('id, order_number, order_type, contact_name, user_id, staff_id, total_pesewas, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

  const todaysSalesTotal = (todaysOrders ?? []).reduce((sum, o) => sum + o.total_pesewas, 0);

  const staffIds = Array.from(new Set((recentOrders ?? []).map((o) => o.staff_id).filter(Boolean))) as string[];
  const namesById: Record<string, string> = {};
  if (staffIds.length > 0) {
    const { data: staffProfiles } = await supabase.from('profiles').select('id, full_name').in('id', staffIds);
    for (const p of staffProfiles ?? []) namesById[p.id] = p.full_name ?? 'Staff';
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

      <div className="rounded-md border border-border-beige bg-surface-card p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-ink-muted">Recent orders</h2>
          <Link href="/admin/orders" className="text-xs text-brand-green hover:underline">
            View all
          </Link>
        </div>

        <div className="flex flex-col gap-3">
          {(recentOrders ?? []).map((order) => (
            <div key={order.id} className="flex items-center justify-between text-sm">
              <div>
                <OrderNumberButton orderId={order.id} orderNumber={order.order_number} />
                <div className="text-xs text-ink-muted">
                  {order.staff_id
                    ? `Sold by ${namesById[order.staff_id] ?? 'Staff'}`
                    : order.contact_name
                    ? order.contact_name
                    : 'Storefront'}
                </div>
              </div>
              <span className="text-ink">{formatGHS(order.total_pesewas)}</span>
            </div>
          ))}
          {(recentOrders ?? []).length === 0 && <p className="text-sm text-ink-muted">No orders yet.</p>}
        </div>
      </div>
    </div>
  );
}