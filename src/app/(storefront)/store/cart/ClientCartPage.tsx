// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState, useTransition } from 'react';
import { useCart } from '@/lib/cart/CartContext';
import { formatGHS } from '@/lib/currency';
import { submitOrder } from './actions';
import PaymentInstructions from '@/components/payments/PaymentInstructions';
import type { PaymentAccount } from '@/lib/paymentTypes';

type Fulfillment = 'pickup' | 'delivery';

const PAY_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'bank_transfer', label: 'Bank transfer' },
];

interface PlacedOrder {
  orderId: string;
  orderNumber: string;
  totalPesewas: number;
  method: string;
  phone: string;
  fulfillment: Fulfillment;
  deliveryAddress: string;
}

export default function ClientCartPage({
  signedInName,
  signedInPhone,
  signedIn,
  paymentAccounts,
}: {
  signedInName: string | null;
  signedInPhone: string | null;
  signedIn: boolean;
  paymentAccounts: PaymentAccount[];
}) {
  const { items, setQuantity, removeItem, totalPesewas, clear } = useCart();
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [fulfillment, setFulfillment] = useState<Fulfillment>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<PlacedOrder | null>(null);

  const payLabel = (value: string, label: string) =>
    value === 'cash' ? (fulfillment === 'delivery' ? 'Cash on delivery' : 'Cash on pickup') : label;

  const deliveryOk = fulfillment === 'pickup' || deliveryAddress.trim().length >= 5;

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set('paymentMethod', paymentMethod);
    formData.set('fulfillmentType', fulfillment);
    formData.set('deliveryAddress', fulfillment === 'delivery' ? deliveryAddress.trim() : '');
    formData.set('deliveryNotes', fulfillment === 'delivery' ? deliveryNotes.trim() : '');
    formData.set(
      'items',
      JSON.stringify(items.map((i) => ({ bookId: i.bookId, quantity: i.quantity })))
    );

    startTransition(async () => {
      try {
        const result = await submitOrder(formData);
        setConfirmation({
          orderId: result.orderId,
          orderNumber: result.orderNumber,
          totalPesewas: result.totalPesewas,
          method: paymentMethod,
          phone: String(formData.get('contactPhone') ?? '').trim(),
          fulfillment,
          deliveryAddress: deliveryAddress.trim(),
        });
        clear();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      }
    });
  }

  if (confirmation) {
    return (
      <div className="mx-auto max-w-md px-6 py-12">
        <h1 className="mb-2 text-center font-serif text-2xl text-ink">Order placed</h1>
        <p className="mb-6 text-center text-sm text-ink-muted">
          Your order number is <span className="font-medium text-ink">{confirmation.orderNumber}</span>. It is reserved
          for you once your payment is confirmed.
        </p>

        {confirmation.fulfillment === 'delivery' && (
          <p className="mb-6 rounded-md bg-surface-cream px-3 py-2 text-center text-sm text-ink">
            Delivering to <span className="font-medium">{confirmation.deliveryAddress}</span>. We&rsquo;ll call{' '}
            {confirmation.phone} to arrange it. The total above doesn&rsquo;t include a delivery fee — we&rsquo;ll
            agree that with you separately.
          </p>
        )}

        <PaymentInstructions
          orderId={signedIn ? confirmation.orderId : undefined}
          orderNumber={confirmation.orderNumber}
          amountPesewas={confirmation.totalPesewas}
          method={confirmation.method}
          accounts={paymentAccounts}
          canReport
          guestPhone={signedIn ? undefined : confirmation.phone}
        />

        <p className="mt-6 text-center text-xs text-ink-muted">
          You can check progress any time on the{' '}
          <a href={signedIn ? '/account/orders' : '/store/track'} className="text-brand-green hover:underline">
            {signedIn ? 'My orders' : 'track order'}
          </a>{' '}
          page{signedIn ? '' : ' with your order number and phone'}.
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
              {fulfillment === 'delivery' && (
                <span className="text-xs text-ink-muted">We&rsquo;ll call this number if the rider can&rsquo;t find you.</span>
              )}
            </label>

            <div className="flex flex-col gap-1 text-sm">
              Pickup or delivery
              <div className="flex gap-4">
                {(['pickup', 'delivery'] as Fulfillment[]).map((f) => (
                  <label key={f} className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="radio"
                      name="fulfillmentChoice"
                      checked={fulfillment === f}
                      onChange={() => setFulfillment(f)}
                    />
                    {f === 'pickup' ? 'I\u2019ll pick it up' : 'Deliver it to me'}
                  </label>
                ))}
              </div>
            </div>

            {fulfillment === 'delivery' && (
              <>
                <label className="flex flex-col gap-1 text-sm">
                  Exact delivery location
                  <input
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="House/landmark, street, area — e.g. near Kasoa Market, blue gate"
                    required
                    className="rounded-md border border-brand-sage px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Notes for the rider (optional)
                  <textarea
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    rows={2}
                    placeholder="Landmark, gate code, best time to come, etc."
                    className="rounded-md border border-brand-sage px-3 py-2"
                  />
                </label>
                <p className="rounded-md bg-surface-cream px-3 py-2 text-xs text-ink-muted">
                  Delivery fee isn&rsquo;t included in the total above — we&rsquo;ll arrange that with you separately.
                </p>
              </>
            )}

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
                  {payLabel(m.value, m.label)}
                </label>
              ))}
            </div>

            {(paymentMethod === 'mobile_money' || paymentMethod === 'bank_transfer') && (
              <p className="rounded-md bg-surface-cream px-3 py-2 text-xs text-ink-muted">
                After you place the order you&rsquo;ll see exactly where to pay. Use your order number as the payment
                reference, then enter the transaction ID.
              </p>
            )}

            <button
              type="submit"
              disabled={isPending || !deliveryOk}
              className="mt-2 rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isPending ? 'Placing order…' : 'Place order'}
            </button>
            {fulfillment === 'delivery' && !deliveryOk && (
              <p className="text-xs text-accent-terracotta">Enter where we should deliver to.</p>
            )}

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