// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useEffect, useState } from 'react';
import { formatGHS } from '@/lib/currency';
import { orderStatusLabel } from '@/lib/orderStatus';
import { getOrderDetails } from '@/lib/actions/orderDetails';
import type { OrderDetails } from '@/lib/orderDetailsTypes';
import PaymentInstructions from '@/components/payments/PaymentInstructions';

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  paid: 'Paid',
  payment_pending: 'Awaiting payment confirmation',
  credit_pending: 'Credit — awaiting approval',
  credit_approved: 'On credit — not yet paid',
  partially_paid: 'Part paid',
};

/**
 * An order number you can click: opens a window with the exact books on that
 * order. Use it anywhere an order number is shown.
 */
export default function OrderNumberButton({
  orderId,
  orderNumber,
  className,
}: {
  orderId: string;
  orderNumber: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<OrderDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setError(null);
    getOrderDetails(orderId)
      .then((result) => {
        if (!cancelled) setDetails(result);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load this order');
      });

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);

    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, orderId]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="See the books in this order"
        className={className ?? 'text-left font-medium text-ink hover:text-brand-green hover:underline'}
      >
        {orderNumber}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Order ${orderNumber}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-md border border-border-beige bg-surface-card p-5 text-sm shadow-lg"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-ink">{orderNumber}</h2>
                {details && <p className="text-xs text-ink-muted">{new Date(details.createdAt).toLocaleString()}</p>}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-ink-muted hover:text-ink"
              >
                ✕
              </button>
            </div>

            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            {!details && !error && <p className="text-ink-muted">Loading…</p>}

            {details && (
              <>
                <div className="mb-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-ink-muted">
                      <tr>
                        <th className="py-1 pr-3 font-medium">Book</th>
                        <th className="py-1 pr-3 text-right font-medium">Qty</th>
                        <th className="py-1 pr-3 text-right font-medium">Price</th>
                        <th className="py-1 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.items.map((item) => (
                        <tr key={item.id} className="border-t border-border-beige">
                          <td className="py-2 pr-3 text-ink">
                            {item.title}
                            {item.author ? <span className="text-ink-muted"> — {item.author}</span> : null}
                          </td>
                          <td className="py-2 pr-3 text-right text-ink">{item.quantity}</td>
                          <td className="py-2 pr-3 text-right text-ink">{formatGHS(item.unitPricePesewas)}</td>
                          <td className="py-2 text-right font-medium text-ink">{formatGHS(item.linePesewas)}</td>
                        </tr>
                      ))}
                      {details.items.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-ink-muted">
                            No books recorded on this order.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mb-4 border-t border-border-beige pt-3 text-xs">
                  {details.discountPesewas > 0 && (
                    <>
                      <div className="flex justify-between text-ink-muted">
                        <span>Subtotal</span>
                        <span>{formatGHS(details.subtotalPesewas)}</span>
                      </div>
                      <div className="flex justify-between text-ink-muted">
                        <span>Discount</span>
                        <span>− {formatGHS(details.discountPesewas)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-sm font-medium text-ink">
                    <span>Total</span>
                    <span>{formatGHS(details.totalPesewas)}</span>
                  </div>
                </div>

                {details.isOwner && details.paymentStatus === 'payment_pending' && (
                  <div className="mb-4">
                    <PaymentInstructions
                      orderId={details.id}
                      orderNumber={details.orderNumber}
                      amountPesewas={details.totalPesewas}
                      method={details.paymentMethod}
                      accounts={details.paymentAccounts}
                      currentReference={details.paymentReference ?? details.chequeNumber}
                      reportedAt={details.paymentReportedAt}
                      canReport
                    />
                  </div>
                )}

                <div className="grid gap-1 text-xs text-ink-muted">
                  <p>
                    Payment:{' '}
                    <span className="capitalize text-ink">{details.paymentMethod.replace('_', ' ')}</span> ·{' '}
                    <span className="text-ink">
                      {PAYMENT_STATUS_LABEL[details.paymentStatus] ?? details.paymentStatus}
                    </span>
                  </p>
                  {(details.paymentReference || details.chequeNumber) && (
                    <p>
                      {details.chequeNumber ? 'Cheque no.' : 'Reference'}:{' '}
                      <span className="text-ink">{details.chequeNumber ?? details.paymentReference}</span>
                    </p>
                  )}
                  <p>
                    Fulfilment:{' '}
                    <span className="capitalize text-ink">{details.fulfillmentType}</span> ·{' '}
                    <span className="text-ink">{orderStatusLabel(details.orderStatus, details.fulfillmentType)}</span>
                  </p>
                  {details.fulfillmentType === 'delivery' && (
                    <p>
                      Deliver to:{' '}
                      <span className="text-ink">{details.deliveryAddress ?? 'Not recorded'}</span>
                      {details.deliveryNotes && (
                        <>
                          {' '}
                          · Notes: <span className="text-ink">{details.deliveryNotes}</span>
                        </>
                      )}
                    </p>
                  )}
                  {details.fulfillmentType === 'delivery' && (
                    <p className="text-ink-muted">Delivery fee isn&rsquo;t included in the total above.</p>
                  )}
                  {details.contactName && (
                    <p>
                      Customer: <span className="text-ink">{details.contactName}</span>
                      {details.contactPhone ? <span className="text-ink"> · {details.contactPhone}</span> : null}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}