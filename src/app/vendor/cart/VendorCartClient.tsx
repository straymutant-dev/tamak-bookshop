// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState, useTransition } from 'react';
import { useCart } from '@/lib/cart/CartContext';
import { formatGHS } from '@/lib/currency';
import { submitVendorOrder, submitVendorOrderImmediatePayment } from './actions';

export default function VendorCartClient({
  availableCreditPesewas,
  vendorApproved,
}: {
  availableCreditPesewas: number;
  vendorApproved: boolean;
}) {
  const { items, setQuantity, removeItem, totalPesewas, clear } = useCart();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [payNow, setPayNow] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentReference, setPaymentReference] = useState('');

  const overLimit = totalPesewas > availableCreditPesewas;

  function handleSubmit() {
    setError(null);
    const formData = new FormData();
    formData.set('items', JSON.stringify(items.map((i) => ({ bookId: i.bookId, quantity: i.quantity }))));

    startTransition(async () => {
      try {
        let result;
        if (payNow) {
          formData.set('paymentMethod', paymentMethod);
          formData.set('paymentReference', paymentReference);
          result = await submitVendorOrderImmediatePayment(formData);
        } else {
          result = await submitVendorOrder(formData);
        }
        setConfirmation(result.orderNumber);
        clear();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      }
    });
  }

  if (confirmation) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="mb-2 font-serif text-2xl text-ink">Credit order submitted</h1>
        <p className="text-ink-muted">
          Order <span className="font-medium text-ink">{confirmation}</span> is pending staff
          approval. You&rsquo;ll see it update on your{' '}
          <a href="/vendor/dashboard" className="text-brand-green hover:underline">
            dashboard
          </a>{' '}
          once approved.
        </p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="mb-2 font-serif text-2xl text-ink">Your cart is empty</h1>
        <a href="/store" className="text-sm text-brand-green hover:underline">
          Browse the catalog
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-10 px-6 py-10 md:grid-cols-[1fr_320px]">
      <div>
        <h1 className="mb-2 font-serif text-2xl text-ink">Wholesale order</h1>
        <p className="mb-6 text-sm text-ink-muted">Prices shown are your wholesale rate.</p>
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <div key={item.bookId} className="flex items-center gap-4 border-b border-border-beige pb-4">
              <div className="h-16 w-12 shrink-0 overflow-hidden rounded-sm bg-surface-cream">
                {item.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.coverUrl} alt={item.title} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-ink">{item.title}</p>
                <p className="text-xs text-ink-muted">{formatGHS(item.unitPricePesewas)} each</p>
              </div>
              <input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) => setQuantity(item.bookId, Number(e.target.value))}
                className="w-16 rounded-md border border-brand-sage px-2 py-1 text-sm"
              />
              <button onClick={() => removeItem(item.bookId)} className="text-xs text-accent-terracotta">
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="rounded-md border border-border-beige bg-surface-card p-5">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-ink-muted">Order total</span>
            <span className="font-medium text-ink">{formatGHS(totalPesewas)}</span>
          </div>
          <div className="mb-4 flex justify-between text-xs text-ink-muted">
            <span>Available credit</span>
            <span>{formatGHS(availableCreditPesewas)}</span>
          </div>

          {!vendorApproved && (
            <p className="mb-4 rounded-md bg-accent-gold/10 px-3 py-2 text-xs text-accent-gold">
              Your wholesale account isn&rsquo;t approved yet — you can&rsquo;t place orders.
            </p>
          )}

          {vendorApproved && (
            <div className="mb-4 flex rounded-md border border-brand-sage p-1 text-xs">
              <button
                type="button"
                onClick={() => setPayNow(false)}
                className={`flex-1 rounded px-2 py-1.5 font-medium ${!payNow ? 'bg-brand-green text-white' : 'text-ink'}`}
              >
                Pay on credit
              </button>
              <button
                type="button"
                onClick={() => setPayNow(true)}
                className={`flex-1 rounded px-2 py-1.5 font-medium ${payNow ? 'bg-brand-green text-white' : 'text-ink'}`}
              >
                Pay now
              </button>
            </div>
          )}

          {vendorApproved && !payNow && overLimit && (
            <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              This order exceeds your available credit. Reduce quantities, or switch to &ldquo;Pay
              now&rdquo; above.
            </p>
          )}

          {vendorApproved && payNow && (
            <div className="mb-4 flex flex-col gap-2 text-xs">
              {[
                { value: 'cash', label: 'Cash on pickup' },
                { value: 'mobile_money', label: 'Mobile Money' },
                { value: 'bank_transfer', label: 'Bank transfer' },
              ].map((m) => (
                <label key={m.value} className="flex items-center gap-2 text-ink">
                  <input
                    type="radio"
                    checked={paymentMethod === m.value}
                    onChange={() => setPaymentMethod(m.value)}
                  />
                  {m.label}
                </label>
              ))}
              {(paymentMethod === 'mobile_money' || paymentMethod === 'bank_transfer') && (
                <input
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Payment reference"
                  className="rounded-md border border-brand-sage px-2 py-1.5 text-xs"
                />
              )}
            </div>
          )}

          {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={isPending || !vendorApproved || (!payNow && overLimit)}
            className="w-full rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending ? 'Submitting…' : payNow ? 'Place order' : 'Submit for approval'}
          </button>

          <p className="mt-3 text-xs text-ink-muted">
            {payNow
              ? 'Stock is reserved immediately once this order is placed.'
              : 'This places the order on your wholesale credit account. Staff will review and approve it before stock is reserved.'}
          </p>
        </div>
      </div>
    </div>
  );
}