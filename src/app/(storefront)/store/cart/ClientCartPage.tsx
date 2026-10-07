// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState, useTransition } from 'react';
import { useCart } from '@/lib/cart/CartContext';
import { formatGHS } from '@/lib/currency';
import { submitOrder } from './actions';

const PAY_METHODS = [
  { value: 'cash', label: 'Cash on pickup' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'bank_transfer', label: 'Bank transfer' },
];

export default function ClientCartPage({
  signedInName,
  signedInPhone,
}: {
  signedInName: string | null;
  signedInPhone: string | null;
}) {
  const { items, setQuantity, removeItem, totalPesewas, clear } = useCart();
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set('paymentMethod', paymentMethod);
    formData.set(
      'items',
      JSON.stringify(items.map((i) => ({ bookId: i.bookId, quantity: i.quantity })))
    );

    startTransition(async () => {
      try {
        const result = await submitOrder(formData);
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
        <h1 className="mb-2 font-serif text-2xl text-ink">Order placed</h1>
        <p className="text-ink-muted">
          Your order number is <span className="font-medium text-ink">{confirmation}</span>. Use
          it with your phone number on the{' '}
          <a href="/store/track" className="text-brand-green hover:underline">
            track order
          </a>{' '}
          page to check status.
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
        <h1 className="mb-6 font-serif text-2xl text-ink">Your cart</h1>
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
              <button
                onClick={() => removeItem(item.bookId)}
                className="text-xs text-accent-terracotta"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="rounded-md border border-border-beige bg-surface-card p-5">
          <div className="mb-4 flex justify-between text-sm">
            <span className="text-ink-muted">Total</span>
            <span className="font-medium text-ink">{formatGHS(totalPesewas)}</span>
          </div>

          {error && (
            <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}

          <form action={handleSubmit} className="flex flex-col gap-3">
            {signedInName ? (
              <>
                <p className="rounded-md bg-surface-cream px-3 py-2 text-sm text-ink">
                  Ordering as <span className="font-medium">{signedInName}</span>
                </p>
                <input type="hidden" name="contactName" value={signedInName} />
              </>
            ) : (
              <label className="flex flex-col gap-1 text-sm">
                Full name
                <input name="contactName" required className="rounded-md border border-brand-sage px-3 py-2" />
              </label>
            )}
            <label className="flex flex-col gap-1 text-sm">
              Phone
              <input
                name="contactPhone"
                type="tel"
                required
                defaultValue={signedInPhone ?? ''}
                className="rounded-md border border-brand-sage px-3 py-2"
              />
            </label>

            <div className="flex flex-col gap-1 text-sm">
              Payment method
              {PAY_METHODS.map((m) => (
                <label key={m.value} className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="radio"
                    name="paymentMethodChoice"
                    checked={paymentMethod === m.value}
                    onChange={() => setPaymentMethod(m.value)}
                  />
                  {m.label}
                </label>
              ))}
            </div>

            {(paymentMethod === 'mobile_money' || paymentMethod === 'bank_transfer') && (
              <label className="flex flex-col gap-1 text-sm">
                Payment reference (if you&rsquo;ve already paid)
                <input name="paymentReference" className="rounded-md border border-brand-sage px-3 py-2" />
              </label>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="mt-2 rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isPending ? 'Placing order…' : 'Place order'}
            </button>

            {!signedInName && (
              <p className="text-xs text-ink-muted">
                Have an account?{' '}
                <a href="/auth/login" className="text-brand-green hover:underline">
                  Log in
                </a>{' '}
                to track orders automatically.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}