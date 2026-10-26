// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastContext';
import { formatGHS } from '@/lib/currency';
import { submitRepaymentRequest } from './actions';
import type { PaymentAccount } from '@/lib/paymentTypes';
import PaymentAccountList from '@/components/payments/PaymentAccountList';

const METHODS = [
  { value: 'mobile_money', label: 'Mobile Money', refLabel: 'Transaction ID' },
  { value: 'bank_transfer', label: 'Bank transfer', refLabel: 'Transfer reference' },
  { value: 'cheque', label: 'Cheque', refLabel: 'Cheque number' },
  { value: 'cash', label: 'Cash', refLabel: 'Receipt number (optional)' },
];

export default function PayBalanceCard({
  outstandingPesewas,
  defaultPhone,
  paymentAccounts,
}: {
  outstandingPesewas: number;
  defaultPhone: string;
  paymentAccounts: PaymentAccount[];
}) {
  const availableMethods = METHODS.filter(
    (candidate) =>
      (candidate.value !== 'mobile_money' && candidate.value !== 'bank_transfer') ||
      paymentAccounts.some((account) => account.kind === candidate.value)
  );
  const [method, setMethod] = useState(
    paymentAccounts.some((account) => account.kind === 'mobile_money')
      ? 'mobile_money'
      : paymentAccounts.some((account) => account.kind === 'bank_transfer')
        ? 'bank_transfer'
        : 'cash'
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const { showToast } = useToast();

  const current = availableMethods.find((m) => m.value === method) ?? availableMethods[0];

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set('method', method);
    startTransition(async () => {
      try {
        await submitRepaymentRequest(formData);
        showToast('Payment submitted — staff will confirm it');
        formRef.current?.reset();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not submit your payment');
      }
    });
  }

  return (
    <div className="mb-8 rounded-md border border-border-beige bg-surface-card p-5">
      <h2 className="mb-1 text-sm font-medium text-ink-muted">Pay my balance</h2>
      <p className="mb-4 text-sm text-ink-muted">
        You owe <span className="font-medium text-ink">{formatGHS(outstandingPesewas)}</span>. Pay Tamak Bookshop, then
        tell us here. Your balance only drops once staff confirm the payment.
      </p>

      <form ref={formRef} action={handleSubmit} className="flex flex-col gap-3">
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Amount paid (GHS)
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              max={outstandingPesewas / 100}
              required
              className="rounded-md border border-brand-sage px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            How did you pay?
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="rounded-md border border-brand-sage px-3 py-2"
            >
              {availableMethods.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          {(method === 'mobile_money' || method === 'bank_transfer') && (
            <div className="sm:col-span-2 rounded-md border border-border-beige bg-surface-cream p-3">
              <p className="text-xs font-medium text-ink">Pay Tamak Bookshop using this {current.label} account</p>
              <PaymentAccountList accounts={paymentAccounts.filter((account) => account.kind === method)} />
              <p className="mt-2 text-xs text-ink-muted">
                Use your name or vendor phone number as the payment narration, then enter the transaction ID below.
              </p>
            </div>
          )}

          <label className="flex flex-col gap-1 text-sm">
            {current.refLabel}
            <input
              name="reference"
              required={method !== 'cash'}
              className="rounded-md border border-brand-sage px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Phone we can reach you on
            <input
              name="phone"
              type="tel"
              defaultValue={defaultPhone}
              placeholder="024 123 4567"
              className="rounded-md border border-brand-sage px-3 py-2"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Note (optional)
          <input name="notes" className="rounded-md border border-brand-sage px-3 py-2" />
        </label>

        <button
          type="submit"
          disabled={isPending}
          className="mt-1 self-start rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? 'Submitting…' : 'Submit payment for confirmation'}
        </button>
      </form>
    </div>
  );
}