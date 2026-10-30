// STRAYMUTANT.DEV — Tamak Bookshop
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatGHS } from '@/lib/currency';
import StatRow from '@/components/admin/StatRow';
import VendorLimitForm from './VendorLimitForm';
import VendorStatementPreview from '@/components/admin/VendorStatementPreview';

const ORDER_STATUS_LABEL: Record<string, string> = {
  paid: 'Paid',
  credit_pending: 'Awaiting approval',
  credit_approved: 'On credit — unpaid',
  partially_paid: 'Partially paid',
  payment_pending: 'Awaiting payment confirmation',
};

const ORDER_STATUS_STYLE: Record<string, string> = {
  paid: 'bg-brand-green/10 text-brand-green',
  credit_pending: 'bg-accent-gold/20 text-accent-gold',
  credit_approved: 'bg-accent-terracotta/10 text-accent-terracotta',
  partially_paid: 'bg-accent-gold/20 text-accent-gold',
  payment_pending: 'bg-accent-terracotta/10 text-accent-terracotta',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: vendor } = await supabase
    .from('profiles')
    .select(
      'id, full_name, business_name, phone, vendor_status, credit_limit_pesewas, outstanding_balance_pesewas, created_at'
    )
    .eq('id', id)
    .eq('role', 'vendor')
    .single();

  if (!vendor) notFound();

  const [{ data: orders }, { data: repayments }] = await Promise.all([
    supabase
      .from('orders')
      .select(
        'id, order_number, payment_status, payment_method, total_pesewas, created_at, order_items(id, quantity, unit_price_pesewas, line_total_pesewas, books(title, author))'
      )
      .eq('user_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('credit_repayments')
      .select('id, amount_pesewas, payment_method, payment_reference, notes, created_at')
      .eq('vendor_id', id)
      .order('created_at', { ascending: false }),
  ]);

  const orderList = orders ?? [];
  const repaymentList = repayments ?? [];

  const pendingTotal = orderList
    .filter((o) => o.payment_status === 'credit_pending')
    .reduce((sum, o) => sum + o.total_pesewas, 0);
  const approvedCreditTotal = orderList
    .filter((o) => o.payment_status === 'credit_approved')
    .reduce((sum, o) => sum + o.total_pesewas, 0);
  const repaidTotal = repaymentList.reduce((sum, r) => sum + r.amount_pesewas, 0);

  const owed = vendor.outstanding_balance_pesewas;
  const available = Math.max(0, vendor.credit_limit_pesewas - owed);
  const expectedOwed = approvedCreditTotal - repaidTotal;
  const balanceMismatch = expectedOwed !== owed;

  return (
    <div>
      <Link href="/admin/vendors" className="mb-4 inline-block text-xs text-brand-green hover:underline">
        ← All vendors
      </Link>

      <div className="mb-1 flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold text-ink">{vendor.business_name ?? vendor.full_name}</h1>
        <span className="rounded-full bg-surface-cream px-2 py-1 text-xs font-medium capitalize text-ink-muted">
          {vendor.vendor_status}
        </span>
        <VendorStatementPreview
          vendorId={vendor.id}
          label="Preview unpaid books (PDF)"
          className="ml-auto inline-flex items-center gap-2 rounded-md border border-brand-green px-3 py-1.5 text-xs font-medium text-brand-green transition-colors hover:bg-brand-green hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
        />
      </div>
      <p className="mb-6 text-sm text-ink-muted">
        {vendor.full_name}
        {vendor.phone ? ` · ${vendor.phone}` : ''} · Joined {formatDate(vendor.created_at)}
      </p>

      <StatRow
        stats={[
          { label: 'Credit limit', value: formatGHS(vendor.credit_limit_pesewas) },
          { label: 'Balance owed', value: formatGHS(owed), accent: owed > 0 ? 'terracotta' : undefined },
          { label: 'Available credit', value: formatGHS(available), accent: 'green' },
          { label: 'Orders awaiting approval', value: formatGHS(pendingTotal), accent: pendingTotal > 0 ? 'gold' : undefined },
        ]}
      />

      {balanceMismatch && (
        <p className="mb-6 rounded-md bg-accent-gold/10 px-3 py-2 text-sm text-accent-gold">
          Heads up: approved credit orders ({formatGHS(approvedCreditTotal)}) minus repayments ({formatGHS(repaidTotal)}) is{' '}
          {formatGHS(expectedOwed)}, but the recorded balance is {formatGHS(owed)}. This usually means a balance was changed
          before the approval fix went in. Check the orders below.
        </p>
      )}

      {vendor.vendor_status === 'approved' ? (
        <div className="mb-8 rounded-md border border-border-beige bg-surface-card p-5">
          <h2 className="mb-3 text-sm font-medium text-ink-muted">Allocate credit</h2>
          <VendorLimitForm vendorId={vendor.id} currentLimitPesewas={vendor.credit_limit_pesewas} />
          {owed > vendor.credit_limit_pesewas && (
            <p className="mt-3 text-xs text-accent-terracotta">
              This vendor already owes more than their limit, so they can&rsquo;t place new credit orders until they repay.
            </p>
          )}
        </div>
      ) : (
        <p className="mb-8 rounded-md bg-surface-cream px-3 py-2 text-sm text-ink-muted">
          Approve this vendor on the vendors list before allocating credit.
        </p>
      )}

      <h2 className="mb-3 text-sm font-medium text-ink-muted">Orders ({orderList.length})</h2>
      <div className="mb-10 overflow-hidden rounded-md border border-border-beige bg-surface-card">
        {orderList.map((order, i) => (
          <details key={order.id} className={i > 0 ? 'border-t border-border-beige' : ''}>
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <div className="font-medium text-ink">{order.order_number}</div>
                <div className="text-xs text-ink-muted">
                  {formatDate(order.created_at)} · {order.order_items.length} item
                  {order.order_items.length === 1 ? '' : 's'}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    ORDER_STATUS_STYLE[order.payment_status] ?? 'bg-surface-cream text-ink-muted'
                  }`}
                >
                  {ORDER_STATUS_LABEL[order.payment_status] ?? order.payment_status}
                </span>
                <span className="font-medium text-ink">{formatGHS(order.total_pesewas)}</span>
              </div>
            </summary>

            <div className="border-t border-border-beige bg-surface-cream/50 px-4 py-3">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-ink-muted">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Book</th>
                      <th className="py-1 pr-3 text-right font-medium">Qty</th>
                      <th className="py-1 pr-3 text-right font-medium">Unit price</th>
                      <th className="py-1 text-right font-medium">Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.order_items.map((item) => {
                      const book = Array.isArray(item.books) ? item.books[0] : item.books;
                      return (
                        <tr key={item.id} className="border-t border-border-beige">
                          <td className="py-2 pr-3 text-ink">
                            {book?.title ?? 'Unknown book'}
                            {book?.author ? <span className="text-ink-muted"> — {book.author}</span> : null}
                          </td>
                          <td className="py-2 pr-3 text-right text-ink">{item.quantity}</td>
                          <td className="py-2 pr-3 text-right text-ink">{formatGHS(item.unit_price_pesewas)}</td>
                          <td className="py-2 text-right font-medium text-ink">{formatGHS(item.line_total_pesewas)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs capitalize text-ink-muted">
                Payment method: {order.payment_method.replace('_', ' ')}
              </p>
            </div>
          </details>
        ))}
        {orderList.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-ink-muted">No orders from this vendor yet.</div>
        )}
      </div>

      <h2 className="mb-3 text-sm font-medium text-ink-muted">Repayments ({repaymentList.length})</h2>
      <div className="overflow-hidden rounded-md border border-border-beige bg-surface-card">
        {repaymentList.map((r, i) => (
          <div
            key={r.id}
            className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm ${
              i > 0 ? 'border-t border-border-beige' : ''
            }`}
          >
            <div>
              <div className="font-medium capitalize text-ink">{r.payment_method.replace('_', ' ')}</div>
              <div className="text-xs text-ink-muted">
                {formatDate(r.created_at)}
                {r.payment_reference ? ` · Ref ${r.payment_reference}` : ''}
                {r.notes ? ` · ${r.notes}` : ''}
              </div>
            </div>
            <span className="font-medium text-brand-green">{formatGHS(r.amount_pesewas)}</span>
          </div>
        ))}
        {repaymentList.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-ink-muted">No repayments recorded yet.</div>
        )}
      </div>
    </div>
  );
}