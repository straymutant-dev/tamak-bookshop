// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState, useTransition } from 'react';
import { useCart } from '@/lib/cart/CartContext';
import { formatGHS } from '@/lib/currency';
import { submitVendorOrder, submitVendorOrderImmediatePayment } from './actions';
import PaymentInstructions from '@/components/payments/PaymentInstructions';
import type { PaymentAccount } from '@/lib/paymentTypes';
import ProcessingButton from '@/components/ui/ProcessingButton';

type Method = 'credit' | 'cash' | 'mobile_money' | 'bank_transfer' | 'cheque';
type Fulfillment = 'pickup' | 'delivery';

const METHOD_LABEL: Record<Method, string> = {
  credit: 'Credit account',
  cash: 'Cash',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
};

export default function VendorCartClient({
  availableCreditPesewas,
  vendorApproved,
  vendorName,
  defaultPhone,
  paymentAccounts,
}: {
  availableCreditPesewas: number;
  vendorApproved: boolean;
  vendorName: string;
  defaultPhone: string;
  paymentAccounts: PaymentAccount[];
}) {
  const { items, setQuantity, removeItem, totalPesewas, clear } = useCart();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    orderId: string;
    orderNumber: string;
    credit: boolean;
    method: string;
    amountPesewas: number;
    fulfillment: Fulfillment;
    deliveryAddress: string;
  } | null>(null);
  const [method, setMethod] = useState<Method | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [operationId] = useState(() => crypto.randomUUID());
  const [phone, setPhone] = useState(defaultPhone);
  const [fulfillment, setFulfillment] = useState<Fulfillment>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  const creditOk = availableCreditPesewas > 0 && totalPesewas <= availableCreditPesewas;
  const chosen: Method = method ?? (creditOk ? 'credit' : 'cash');
  const useCredit = chosen === 'credit';
  const overLimit = useCredit && !creditOk;
  const deliveryOk = fulfillment === 'pickup' || deliveryAddress.trim().length >= 5;

  const methodLabel = (m: Method) =>
    m === 'cash' ? (fulfillment === 'delivery' ? 'Cash on delivery' : 'Cash on pickup') : METHOD_LABEL[m];

  function handleSubmit() {
    setError(null);
    const formData = new FormData();
    formData.set('operationId', operationId);
    formData.set('items', JSON.stringify(items.map((i) => ({ bookId: i.bookId, quantity: i.quantity }))));
    formData.set('contactPhone', phone);
    formData.set('fulfillmentType', fulfillment);
    formData.set('deliveryAddress', fulfillment === 'delivery' ? deliveryAddress.trim() : '');
    formData.set('deliveryNotes', fulfillment === 'delivery' ? deliveryNotes.trim() : '');

    startTransition(async () => {
      try {
        let result;
        if (useCredit) {
          result = await submitVendorOrder(formData);
        } else {
          formData.set('paymentMethod', chosen);
          formData.set('paymentReference', paymentReference);
          result = await submitVendorOrderImmediatePayment(formData);
        }
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setConfirmation({
          orderId: result.orderId,
          orderNumber: result.orderNumber,
          credit: useCredit,
          method: chosen,
          amountPesewas: result.totalPesewas,
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
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="mb-2 font-serif text-2xl text-ink">
          {confirmation.credit ? 'Credit order submitted' : 'Order placed'}
        </h1>
        {confirmation.fulfillment === 'delivery' && (
          <p className="mb-4 rounded-md bg-surface-cream px-3 py-2 text-sm text-ink">
            Delivering to <span className="font-medium">{confirmation.deliveryAddress}</span>. The total above
            doesn&rsquo;t include a delivery fee — we&rsquo;ll agree that with you separately.
          </p>
        )}
        {confirmation.credit ? (
          <p className="text-ink-muted">
            Order <span className="font-medium text-ink">{confirmation.orderNumber}</span> is pending staff approval,
            and the amount is reserved from your available credit. You&rsquo;ll see it update on your{' '}
            <a href="/vendor/dashboard" className="text-brand-green hover:underline">
              dashboard
            </a>{' '}
            once approved.
          </p>
        ) : (
          <div className="mt-4">
            <p className="mb-4 text-ink-muted">
              Order <span className="font-medium text-ink">{confirmation.orderNumber}</span> has been placed. It is
              marked paid only after staff confirm your payment. It is not on your credit account.
            </p>
            <PaymentInstructions
              orderId={confirmation.orderId}
              orderNumber={confirmation.orderNumber}
              amountPesewas={confirmation.amountPesewas}
              method={confirmation.method}
              accounts={paymentAccounts}
              canReport
            />
          </div>
        )}
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
          <p className="mb-3 rounded-md bg-surface-cream px-3 py-2 text-sm text-ink">
            Ordering as <span className="font-medium">{vendorName}</span>
          </p>

          {vendorApproved && (
            <label className="mb-4 flex flex-col gap-1 text-sm">
              Phone we can reach you on
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="024 123 4567"
                className="rounded-md border border-brand-sage px-3 py-2 text-sm"
              />
              <span className="text-xs text-ink-muted">Used for delivery and payment follow-up.</span>
            </label>
          )}

          {vendorApproved && (
            <div className="mb-4 flex flex-col gap-1 text-sm">
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
                    {f === 'pickup' ? 'We\u2019ll pick it up' : 'Deliver it to us'}
                  </label>
                ))}
              </div>
            </div>
          )}

          {vendorApproved && fulfillment === 'delivery' && (
            <div className="mb-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                Exact delivery location
                <input
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Shop/office address, street, area"
                  required
                  className="rounded-md border border-brand-sage px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Notes for the rider (optional)
                <textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  rows={2}
                  placeholder="Landmark, gate code, best time to come, etc."
                  className="rounded-md border border-brand-sage px-3 py-2 text-sm"
                />
              </label>
              <p className="rounded-md bg-surface-cream px-3 py-2 text-xs text-ink-muted">
                Delivery fee isn&rsquo;t included in the order total below — we&rsquo;ll arrange that with you
                separately.
              </p>
            </div>
          )}

          <div className="mb-4 flex justify-between text-sm">
            <span className="text-ink-muted">Order total</span>
            <span className="font-medium text-ink">{formatGHS(totalPesewas)}</span>
          </div>

          {!vendorApproved && (
            <p className="mb-4 rounded-md bg-accent-gold/10 px-3 py-2 text-xs text-accent-gold">
              Your wholesale account isn&rsquo;t approved yet — you can&rsquo;t place orders.
            </p>
          )}

          {vendorApproved && (
            <div className="mb-4 flex flex-col gap-3 text-sm">
              <span className="text-ink">Payment method</span>
              {(Object.keys(METHOD_LABEL) as Method[]).map((m) => {
                const disabled = m === 'credit' && !creditOk;
                return (
                  <label
                    key={m}
                    className={`flex items-start gap-2 ${disabled ? 'cursor-not-allowed text-ink-muted' : 'text-ink'}`}
                  >
                    <input
                      type="radio"
                      name="paymentMethodChoice"
                      className="mt-1"
                      checked={chosen === m}
                      disabled={disabled}
                      onChange={() => setMethod(m)}
                    />
                    <span>
                      {methodLabel(m)}
                      {m === 'credit' && (
                        <span className="block text-xs text-ink-muted">
                          Available: {formatGHS(availableCreditPesewas)}
                          {disabled && availableCreditPesewas > 0 && (
                            <> · this order is {formatGHS(totalPesewas - availableCreditPesewas)} over</>
                          )}
                          {disabled && availableCreditPesewas === 0 && <> · no credit available</>}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}

              {(chosen === 'mobile_money' || chosen === 'bank_transfer') && (
                <p className="rounded-md bg-surface-cream px-3 py-2 text-xs text-ink-muted">
                  After you place the order you&rsquo;ll see where to pay. Use your order number as the payment
                  reference, then enter the transaction ID.
                </p>
              )}
              {chosen === 'cheque' && (
                <input
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Cheque number (if you have it)"
                  className="rounded-md border border-brand-sage px-2 py-1.5 text-xs"
                />
              )}
            </div>
          )}

          {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

          <ProcessingButton
            type="button"
            onClick={handleSubmit}
            isProcessing={isPending}
            processingText="Submitting…"
            disabled={!vendorApproved || overLimit || phone.trim().length < 9 || !deliveryOk}
            className="w-full rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {useCredit ? 'Submit for approval' : 'Place order'}
          </ProcessingButton>
          {fulfillment === 'delivery' && !deliveryOk && (
            <p className="mt-2 text-xs text-accent-terracotta">Enter where we should deliver to.</p>
          )}

          <p className="mt-3 text-xs text-ink-muted">
            {useCredit
              ? 'The amount is reserved from your available credit now. It only becomes owed once staff approve the order.'
              : 'This order is marked paid only after staff confirm your payment, with its reference.'}
          </p>
        </div>
      </div>
    </div>
  );
}