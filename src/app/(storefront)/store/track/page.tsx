// STRAYMUTANT.DEV — Tamak Bookshop
// Path: src/app/(storefront)/store/track/page.tsx
'use client';

import { useState } from 'react';
import { formatGHS } from '@/lib/currency';
import { orderStatusLabel } from '@/lib/orderStatus';
import PaymentInstructions from '@/components/payments/PaymentInstructions';
import ProcessingButton from '@/components/ui/ProcessingButton';
import type { PaymentAccount } from '@/lib/paymentTypes';

interface TrackedOrder {
  order_number: string;
  payment_method: string;
  payment_status: string;
  payment_reference: string | null;
  payment_reported_at: string | null;
  cheque_number: string | null;
  can_report: boolean;
  total_pesewas: number;
  discount_pesewas: number;
  fulfillment_type: string;
  order_status: string;
  created_at: string;
  order_items: { quantity: number; unit_price_pesewas: number; books: { title: string } }[];
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  paid: 'Paid',
  payment_pending: 'Awaiting payment confirmation',
  credit_pending: 'Credit — awaiting approval',
  credit_approved: 'On credit — not yet paid',
  partially_paid: 'Part paid',
};

export default function TrackOrderPage() {
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [lookupPhone, setLookupPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOrder(null);
    setAccounts([]);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const phone = String(formData.get('phone') ?? '');
    try {
      const res = await fetch('/api/orders/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: formData.get('orderNumber'),
          phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Order not found');
      setLookupPhone(phone);
      setAccounts(data.paymentAccounts ?? []);
      setOrder(data.order);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const awaitingPayment = order?.payment_status === 'payment_pending';

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="mb-6 font-serif text-2xl text-ink">Track your order</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Order number
          <input name="orderNumber" required className="rounded-md border border-brand-sage px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Phone used at checkout
          <input name="phone" type="tel" required className="rounded-md border border-brand-sage px-3 py-2" />
        </label>
        <ProcessingButton
          type="submit"
          isProcessing={loading}
          processingText="Looking up…"
          className="mt-2 rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Track order
        </ProcessingButton>
      </form>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {order && (
        <div className="mt-6 rounded-md border border-border-beige bg-surface-card p-5">
          <div className="mb-3 flex justify-between text-sm">
            <span className="font-medium text-ink">{order.order_number}</span>
            <span className="rounded-full bg-surface-cream px-3 py-1 text-xs font-medium text-brand-green">
              {orderStatusLabel(order.order_status, order.fulfillment_type)}
            </span>
          </div>
          <p className="mb-3 text-xs capitalize text-ink-muted">{order.fulfillment_type}</p>
          <div className="flex flex-col gap-2">
            {order.order_items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm text-ink-muted">
                <span>
                  {item.quantity} × {item.books.title}
                </span>
                <span>{formatGHS(item.unit_price_pesewas * item.quantity)}</span>
              </div>
            ))}
          </div>
          {order.discount_pesewas > 0 && (
            <div className="mt-2 flex justify-between text-sm text-ink-muted">
              <span>Discount</span>
              <span>−{formatGHS(order.discount_pesewas)}</span>
            </div>
          )}
          <div className="mt-3 flex justify-between border-t border-border-beige pt-3 text-sm font-medium text-ink">
            <span>Total</span>
            <span>{formatGHS(order.total_pesewas)}</span>
          </div>

          <p className="mt-3 text-xs text-ink-muted">
            Payment: <span className="capitalize text-ink">{order.payment_method.replace('_', ' ')}</span> ·{' '}
            <span className="text-ink">{PAYMENT_STATUS_LABEL[order.payment_status] ?? order.payment_status}</span>
          </p>
        </div>
      )}

      {order && awaitingPayment && (
        <div className="mt-4">
          <PaymentInstructions
            key={order.order_number}
            orderNumber={order.order_number}
            amountPesewas={order.total_pesewas}
            method={order.payment_method}
            accounts={accounts}
            currentReference={order.payment_reference ?? order.cheque_number}
            reportedAt={order.payment_reported_at}
            canReport={order.can_report}
            guestPhone={lookupPhone}
          />
          {!order.can_report && (
            <p className="mt-3 text-xs text-ink-muted">
              This order belongs to a registered account. Log in and open <span className="text-ink">My orders</span>{' '}
              to tell us once you have paid.
            </p>
          )}
        </div>
      )}
    </div>
  );
}