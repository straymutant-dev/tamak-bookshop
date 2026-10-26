// STRAYMUTANT.DEV — Tamak Bookshop
import Link from 'next/link';
import { Check, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

/** A short list of things that are waiting on staff. Each row opens the page that deals with it. */
export default async function NeedsAttention({ isAdmin }: { isAdmin: boolean }) {
  const supabase = await createClient();

  const [payments, credits, vendors, lowStock, repayments] = await Promise.all([
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('payment_status', 'payment_pending'),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('payment_status', 'credit_pending'),
    isAdmin
      ? supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'vendor').eq('vendor_status', 'pending')
      : Promise.resolve({ count: 0 }),
    supabase.rpc('low_stock_count' as never),
    supabase.from('repayment_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  const paymentsN = payments.count ?? 0;
  const creditsN = credits.count ?? 0;
  const vendorsN = vendors.count ?? 0;
  const lowStockN = lowStock.data ?? 0;
  const repaymentsN = repayments.count ?? 0;

  const rows = [
    {
      n: paymentsN,
      title: plural(paymentsN, 'Payment to confirm', 'Payments to confirm'),
      hint: 'Mobile money and bank transfers waiting',
      href: '/admin/orders?tab=vendor',
      hot: true,
    },
    {
      n: creditsN,
      title: plural(creditsN, 'Credit order to approve', 'Credit orders to approve'),
      hint: 'Vendors waiting for a decision',
      href: '/admin/orders?tab=vendor',
      hot: true,
    },
    ...(isAdmin
      ? [
          {
            n: vendorsN,
            title: plural(vendorsN, 'Vendor to approve', 'Vendors to approve'),
            hint: 'New wholesale sign-ups',
            href: '/admin/vendors',
            hot: false,
          },
        ]
      : []),
    {
      n: lowStockN,
      title: plural(lowStockN, 'Title low on stock', 'Titles low on stock'),
      hint: 'At or below their alert level',
      href: '/admin/inventory',
      hot: false,
    },
    {
      n: repaymentsN,
      title: plural(repaymentsN, 'Repayment to confirm', 'Repayments to confirm'),
      hint: 'Vendor payments to check',
      href: '/admin/repayments',
      hot: false,
    },
  ];

  // Things that need doing come first; "all clear" rows sink to the bottom.
  const ordered = [...rows.filter((r) => r.n > 0), ...rows.filter((r) => r.n === 0)];

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-serif text-xl text-brand-green">Needs attention</h2>
        <span className="text-xs text-ink-muted">Today</span>
      </div>
      <div className="flex flex-col gap-2">
        {ordered.map((row) =>
          row.n > 0 ? (
            <Link
              key={row.title}
              href={row.href}
              className="flex items-center gap-4 rounded-2xl border border-border-beige bg-surface-card p-3 hover:border-brand-sage"
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-semibold ${
                  row.hot ? 'bg-accent-terracotta/10 text-accent-terracotta' : 'bg-brand-green/10 text-brand-green'
                }`}
              >
                {row.n}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">{row.title}</span>
                <span className="block text-xs text-ink-muted">{row.hint}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-ink-muted" aria-hidden="true" />
            </Link>
          ) : (
            <Link
              key={row.title}
              href={row.href}
              className="flex items-center gap-4 rounded-2xl border border-border-beige bg-surface-card/60 p-3"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center text-brand-green/70">
                <Check size={18} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-ink-muted">{row.title}</span>
                <span className="block text-xs text-ink-muted">All clear</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-ink-muted" aria-hidden="true" />
            </Link>
          )
        )}
      </div>
    </section>
  );
}