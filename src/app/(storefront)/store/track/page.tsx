// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState } from 'react';
import { formatGHS } from '@/lib/currency';
import { orderStatusLabel } from '@/lib/orderStatus';

interface TrackedOrder {
  order_number: string;
  payment_method: string;
  payment_status: string;
  total_pesewas: number;
  discount_pesewas: number;
  fulfillment_type: string;
  order_status: string;
  created_at: string;
  order_items: { quantity: number; unit_price_pesewas: number; books: { title: string } }[];
}

export default function TrackOrderPage() {
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOrder(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/orders/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: formData.get('orderNumber'),
          phone: formData.get('phone'),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Order not found');
      setOrder(data.order);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

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
        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Looking up…' : 'Track order'}
        </button>
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
        </div>
      )}
    </div>
  );
}