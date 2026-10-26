// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState, useTransition } from 'react';
import { formatGHS } from '@/lib/currency';
import { reportPayment } from '@/lib/actions/payments';
import type { PaymentAccount } from '@/lib/paymentTypes';
import PaymentAccountList from './PaymentAccountList';

/**
 * Tells the customer exactly where to pay and what to write as the reference
 * (their order number), then lets them enter the transaction ID once they've paid.
 */
export default function PaymentInstructions({
  orderId,
  orderNumber,
  amountPesewas,
  method,
  accounts,
  currentReference,
  reportedAt,
  canReport,
  guestPhone,
}: {
  orderId?: string;
  orderNumber: string;
  amountPesewas: number;
  method: string;
  accounts: PaymentAccount[];
  currentReference?: string | null;
  reportedAt?: string | null;
  canReport: boolean;
  guestPhone?: string;
}) {
  const [reference, setReference] = useState(currentReference ?? '');
  const [reported, setReported] = useState(Boolean(reportedAt));
  const [error, setError] = useState<string | null>(null);
  const [copiedOrderNumber, setCopiedOrderNumber] = useState(false);
  const [isPending, startTransition] = useTransition();

  const matching = accounts.filter((a) => a.kind === method);
  const needsReference = method !== 'cash';

  async function copyOrderNumber() {
    try {
      await navigator.clipboard.writeText(orderNumber);
      setCopiedOrderNumber(true);
      window.setTimeout(() => setCopiedOrderNumber(false), 1500);
    } catch {
      setError('Could not copy the order number. Please copy it manually.');
    }
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await reportPayment({ orderId, orderNumber, phone: guestPhone, reference });
        setReported(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save your reference');
      }
    });
  }

  if (method === 'cash') {
    return (
      <div className="rounded-md border border-border-beige bg-surface-cream p-4 text-left text-sm">
        <p className="font-medium text-ink">Pay {formatGHS(amountPesewas)} in cash</p>
        <p className="mt-1 text-xs text-ink-muted">
          Pay when you collect your order. Quote <span className="font-medium text-ink">{orderNumber}</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border-beige bg-surface-cream p-4 text-left text-sm">
      <p className="font-medium text-ink">How to pay {formatGHS(amountPesewas)}</p>

      {method === 'cheque' ? (
        <p className="mt-2 text-xs text-ink-muted">
          Make the cheque payable to Tamak Bookshop and write{' '}
          <span className="font-medium text-ink">{orderNumber}</span> on the back.
        </p>
      ) : (
        <PaymentAccountList accounts={matching} />
      )}

      {method !== 'cheque' && (
        <div className="mt-3 rounded-md border border-accent-gold bg-accent-gold/10 p-3 text-xs text-ink">
          <p>
            Use <span className="font-semibold">{orderNumber}</span> as the payment reference (the note or narration), so
            we can match your payment.
          </p>
          <button
            type="button"
            onClick={() => void copyOrderNumber()}
            className="mt-1 text-xs text-brand-green hover:underline"
          >
            {copiedOrderNumber ? 'Copied' : 'Copy order number'}
          </button>
        </div>
      )}

      {canReport && needsReference && (
        <div className="mt-4">
          {reported ? (
            <p className="rounded-md bg-brand-green/10 px-3 py-2 text-xs text-brand-green">
              Thank you. We have your {method === 'cheque' ? 'cheque number' : 'payment reference'}{' '}
              <span className="font-medium">{reference}</span> and will confirm your payment shortly.
            </p>
          ) : (
            <>
              <label className="flex flex-col gap-1 text-xs text-ink-muted">
                {method === 'cheque'
                  ? 'After you send the cheque, enter its number'
                  : 'After you have paid, enter the transaction ID or reference'}
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="rounded-md border border-brand-sage px-3 py-2 text-sm text-ink"
                />
              </label>
              {error && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
              <button
                type="button"
                onClick={submit}
                disabled={isPending || !reference.trim()}
                className="mt-2 rounded-md bg-brand-green px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
              >
                {isPending ? 'Saving…' : "I've paid"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}