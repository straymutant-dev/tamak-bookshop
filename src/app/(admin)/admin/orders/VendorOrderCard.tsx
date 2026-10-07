// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState, useTransition } from 'react';
import { formatGHS } from '@/lib/currency';
import { useToast } from '@/components/ui/ToastContext';
import { approveCreditOrder, confirmOrderPayment, rejectVendorOrder } from './vendorActions';

export interface VendorOrderCardProps {
  order: {
    id: string;
    orderNumber: string;
    createdAt: string;
    totalPesewas: number;
    paymentStatus: string; // 'credit_pending' | 'payment_pending'
    fulfillmentType: string;
    paymentReportedAt: string | null;
    /** vendor = wholesale account order; customer = ordinary online order */
    kind: 'vendor' | 'customer';
    paymentMethod: string;
    paymentReference: string | null;
    contactPhone: string | null;
    items: { title: string; quantity: number; unitPricePesewas: number; linePesewas: number }[];
  };
  vendor: {
    name: string;
    limitPesewas: number;
    owedPesewas: number;
  };
}

const RECEIVED_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
] as const;

type Received = (typeof RECEIVED_METHODS)[number]['value'];

export default function VendorOrderCard({ order, vendor }: VendorOrderCardProps) {
  const isCredit = order.paymentStatus === 'credit_pending';

  const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>(
    order.fulfillmentType === 'delivery' ? 'delivery' : 'pickup'
  );
  const [method, setMethod] = useState<Received>(
    RECEIVED_METHODS.some((m) => m.value === order.paymentMethod) ? (order.paymentMethod as Received) : 'cash'
  );
  const [reference, setReference] = useState(order.paymentReference ?? '');
  const [chequeCleared, setChequeCleared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const overLimit = isCredit && vendor.owedPesewas + order.totalPesewas > vendor.limitPesewas;
  const needsRef = method !== 'cash';
  const canConfirm = !(needsRef && !reference.trim()) && !(method === 'cheque' && !chequeCleared);

  function run(action: () => Promise<void>, doneMessage: string) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        showToast(doneMessage);
        setResolved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      }
    });
  }

  function handleReject() {
    if (!window.confirm(`Reject ${order.orderNumber} and remove it? The vendor's reserved credit is released.`)) return;
    run(() => rejectVendorOrder(order.id), 'Order rejected');
  }

  if (resolved) return null;

  return (
    <div className="rounded-md border border-border-beige bg-surface-card p-5 text-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-ink">{vendor.name}</p>
          <p className="text-xs text-ink-muted">
            {order.orderNumber} · {new Date(order.createdAt).toLocaleString()}
          </p>
          {order.contactPhone ? (
            <p className="mt-1 text-xs text-ink">
              Phone:{' '}
              <a href={`tel:${order.contactPhone}`} className="text-brand-green hover:underline">
                {order.contactPhone}
              </a>
            </p>
          ) : (
            <p className="mt-1 text-xs text-accent-terracotta">No phone number on this order</p>
          )}
        </div>
        <div className="text-right">
          <p className="font-medium text-ink">{formatGHS(order.totalPesewas)}</p>
          {order.kind === 'customer' && <p className="mt-1 text-xs text-ink-muted">Online customer</p>}
          <span
            className={`mt-1 inline-block rounded-full px-2 py-1 text-xs font-medium ${
              isCredit ? 'bg-accent-gold/20 text-accent-gold' : 'bg-accent-terracotta/10 text-accent-terracotta'
            }`}
          >
            {isCredit ? 'Credit — awaiting approval' : `Pay now — ${order.paymentMethod.replace('_', ' ')}`}
          </span>
        </div>
      </div>

      <table className="mb-4 w-full text-xs">
        <tbody>
          {order.items.map((item, i) => (
            <tr key={i} className="border-t border-border-beige">
              <td className="py-1.5 pr-3 text-ink">{item.title}</td>
              <td className="py-1.5 pr-3 text-right text-ink-muted">
                {item.quantity} × {formatGHS(item.unitPricePesewas)}
              </td>
              <td className="py-1.5 text-right text-ink">{formatGHS(item.linePesewas)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {isCredit && (
        <p className="mb-4 text-xs text-ink-muted">
          Credit limit {formatGHS(vendor.limitPesewas)} · currently owes {formatGHS(vendor.owedPesewas)}
        </p>
      )}
      {overLimit && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          Approving would put this vendor over their credit limit, so it will be refused. Raise their limit on the
          vendor page first, or reject the order.
        </p>
      )}

      {!isCredit && (
        <p
          className={`mb-3 rounded-md px-3 py-2 text-xs ${
            order.paymentReportedAt ? 'bg-brand-green/10 text-brand-green' : 'bg-surface-cream text-ink-muted'
          }`}
        >
          {order.paymentReportedAt
            ? `They say they paid ${new Date(order.paymentReportedAt).toLocaleString()}. Check the reference below against your account before confirming.`
            : 'They have not reported a payment yet. Confirm only once the money is in your account.'}
        </p>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Fulfilment
          <select
            value={fulfillment}
            onChange={(e) => setFulfillment(e.target.value as 'pickup' | 'delivery')}
            className="rounded-md border border-brand-sage px-3 py-2 text-sm text-ink"
          >
            <option value="pickup">Pickup</option>
            <option value="delivery">Delivery</option>
          </select>
        </label>

        {!isCredit && (
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Payment received via
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as Received)}
              className="rounded-md border border-brand-sage px-3 py-2 text-sm text-ink"
            >
              {RECEIVED_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {!isCredit && (
          <label className="flex flex-col gap-1 text-xs text-ink-muted sm:col-span-2">
            {method === 'cheque'
              ? 'Cheque number'
              : method === 'cash'
              ? 'Receipt number (optional)'
              : 'Payment reference / transaction ID'}
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="rounded-md border border-brand-sage px-3 py-2 text-sm text-ink"
            />
          </label>
        )}

        {!isCredit && method === 'cheque' && (
          <label className="flex items-center gap-2 text-xs text-ink sm:col-span-2">
            <input type="checkbox" checked={chequeCleared} onChange={(e) => setChequeCleared(e.target.checked)} />
            The cheque has cleared
          </label>
        )}
      </div>

      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {isCredit ? (
          <button
            onClick={() => run(() => approveCreditOrder(order.id, fulfillment), 'Credit order approved')}
            disabled={isPending}
            className="rounded-md bg-brand-green px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {isPending ? 'Working…' : 'Approve credit'}
          </button>
        ) : (
          <button
            onClick={() =>
              run(
                () => confirmOrderPayment(order.id, fulfillment, method, reference, chequeCleared),
                'Payment confirmed — order marked paid'
              )
            }
            disabled={isPending || !canConfirm}
            className="rounded-md bg-brand-green px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {isPending ? 'Working…' : 'Confirm payment received'}
          </button>
        )}
        <button
          onClick={handleReject}
          disabled={isPending}
          className="rounded-md border border-accent-terracotta px-4 py-2 text-xs text-accent-terracotta disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}