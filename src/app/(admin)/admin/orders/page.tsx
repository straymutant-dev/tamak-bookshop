// STRAYMUTANT.DEV — Tamak Bookshop
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import OrdersTable from './OrdersTable';
import OrdersFilters from './OrdersFilters';
import VendorOrdersPanel from './VendorOrdersPanel';
import WalkinCreditPanel from './WalkinCreditPanel';

const PAGE_SIZE = 50;

const TYPE_OPTIONS = [
  { value: 'storefront_client', label: 'Online — customers' },
  { value: 'storefront_vendor', label: 'Online — vendors' },
  { value: 'counter_pos', label: 'Counter (POS)' },
];

const STATUS_OPTIONS = [
  { value: 'paid', label: 'Paid' },
  { value: 'payment_pending', label: 'Awaiting payment confirmation' },
  { value: 'credit_pending', label: 'Credit — awaiting approval' },
  { value: 'credit_approved', label: 'On credit — unpaid' },
  { value: 'partially_paid', label: 'Part paid' },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Ghana is on GMT all year, so a UTC day is the same as a local day.
function dayStart(date: string) {
  return `${date}T00:00:00.000Z`;
}
function dayAfter(date: string) {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

interface Params {
  tab?: string;
  q?: string;
  from?: string;
  to?: string;
  type?: string;
  status?: string;
  page?: string;
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const showVendor = params.tab === 'vendor';
  const showWalkin = params.tab === 'walkin';
  const supabase = await createClient();

  const { count: waitingCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('order_type', 'storefront_vendor')
    .in('payment_status', ['credit_pending', 'payment_pending']);

  const { count: walkinOwingCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('order_type', 'counter_pos')
    .is('user_id', null)
    .eq('payment_status', 'credit_approved');

  const tabClass = (active: boolean) =>
    `border-b-2 px-4 py-2 text-sm ${
      active ? 'border-brand-green font-medium text-brand-green' : 'border-transparent text-ink-muted hover:text-ink'
    }`;

  let content: React.ReactNode;

  if (showVendor) {
    content = <VendorOrdersPanel />;
  } else if (showWalkin) {
    content = <WalkinCreditPanel />;
  } else {
    // ---- All orders, with search and filters ---------------------------------
    // Characters that would break the filter syntax are removed from the search text.
    const q = (params.q ?? '').replace(/[,()%*\\]/g, ' ').trim().slice(0, 60);
    const from = DATE_RE.test(params.from ?? '') ? (params.from as string) : '';
    const to = DATE_RE.test(params.to ?? '') ? (params.to as string) : '';
    const type = TYPE_OPTIONS.some((o) => o.value === params.type) ? (params.type as string) : '';
    const status = STATUS_OPTIONS.some((o) => o.value === params.status) ? (params.status as string) : '';
    const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    let query = supabase
      .from('orders')
      .select(
        'id, order_number, order_type, payment_method, payment_status, total_pesewas, discount_pesewas, fulfillment_type, order_status, payment_reference, cheque_number, cheque_cleared, contact_name, user_id, staff_id, created_at',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false });

    if (q) query = query.or(`order_number.ilike.%${q}%,contact_name.ilike.%${q}%,contact_phone.ilike.%${q}%`);
    if (from) query = query.gte('created_at', dayStart(from));
    if (to) query = query.lt('created_at', dayAfter(to));
    if (type) query = query.eq('order_type', type as 'storefront_client' | 'storefront_vendor' | 'counter_pos');
    if (status) {
      query = query.eq(
        'payment_status',
        status as 'paid' | 'payment_pending' | 'credit_pending' | 'credit_approved' | 'partially_paid'
      );
    }

    const { data: orders, error, count } = await query.range(offset, offset + PAGE_SIZE - 1);

    const staffIds = Array.from(new Set((orders ?? []).map((o) => o.staff_id).filter(Boolean))) as string[];
    const customerIds = Array.from(new Set((orders ?? []).map((o) => o.user_id).filter(Boolean))) as string[];
    const allIds = Array.from(new Set([...staffIds, ...customerIds]));

    const namesById: Record<string, string> = {};
    if (allIds.length > 0) {
      const { data: people } = await supabase.from('profiles').select('id, full_name').in('id', allIds);
      for (const person of people ?? []) {
        namesById[person.id] = person.full_name ?? 'Unknown';
      }
    }

    const total = count ?? 0;
    const firstShown = total === 0 ? 0 : offset + 1;
    const lastShown = Math.min(offset + PAGE_SIZE, total);
    const hasFilters = Boolean(q || from || to || type || status);

    const pageLink = (target: number) => {
      const sp = new URLSearchParams();
      if (q) sp.set('q', q);
      if (from) sp.set('from', from);
      if (to) sp.set('to', to);
      if (type) sp.set('type', type);
      if (status) sp.set('status', status);
      if (target > 1) sp.set('page', String(target));
      const qs = sp.toString();
      return `/admin/orders${qs ? `?${qs}` : ''}`;
    };

    content = (
      <>
        <OrdersFilters
          initial={{ q, from, to, type, status }}
          typeOptions={TYPE_OPTIONS}
          statusOptions={STATUS_OPTIONS}
        />

        <p className="mb-4 text-sm text-ink-muted">
          {hasFilters ? 'Matching orders' : 'Every sale on the platform, most recent first'}
          {total > 0 ? ` · showing ${firstShown}–${lastShown} of ${total}` : ''}
        </p>

        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            Failed to load orders: {error.message}
          </p>
        )}

        <OrdersTable orders={orders ?? []} namesById={namesById} />

        {total === 0 && !error && (
          <p className="mt-4 text-sm text-ink-muted">
            {hasFilters ? 'No orders match that search.' : 'No orders yet.'}
          </p>
        )}

        {total > PAGE_SIZE && (
          <div className="mt-6 flex items-center justify-between text-sm">
            {page > 1 ? (
              <Link href={pageLink(page - 1)} className="text-brand-green hover:underline">
                ← Newer
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs text-ink-muted">
              Page {page} of {Math.ceil(total / PAGE_SIZE)}
            </span>
            {lastShown < total ? (
              <Link href={pageLink(page + 1)} className="text-brand-green hover:underline">
                Older →
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-ink">Orders & sales</h1>

      <div className="mb-6 flex gap-2 border-b border-border-beige">
        <Link href="/admin/orders" className={tabClass(!showVendor && !showWalkin)}>
          All orders
        </Link>
        <Link href="/admin/orders?tab=vendor" className={tabClass(showVendor)}>
          Vendor orders
          {(waitingCount ?? 0) > 0 && (
            <span className="ml-2 rounded-full bg-accent-terracotta px-2 py-0.5 text-xs font-medium text-white">
              {waitingCount}
            </span>
          )}
        </Link>
        <Link href="/admin/orders?tab=walkin" className={tabClass(showWalkin)}>
          Walk-in credit
          {(walkinOwingCount ?? 0) > 0 && (
            <span className="ml-2 rounded-full bg-accent-gold px-2 py-0.5 text-xs font-medium text-white">
              {walkinOwingCount}
            </span>
          )}
        </Link>
      </div>

      {content}
    </div>
  );
}