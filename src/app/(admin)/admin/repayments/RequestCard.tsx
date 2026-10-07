// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState, useTransition } from 'react';
import { formatGHS } from '@/lib/currency';
import { useToast } from '@/components/ui/ToastContext';
import { confirmRepaymentRequest, rejectRepaymentRequest } from './requestActions';

export interface RequestCardProps {
  request: {
    id: string;
    amountPesewas: number;
    paymentMethod: string;
    paymentReference: string | null;
    contactPhone: string | null;
    notes: string | null;
    createdAt: string;
  };
  vendor: { name: string; owedPesewas: number };
}

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
] as const;

type Received = (typeof METHODS)[number]['value'];

export default function RequestCard({ request, vendor }: RequestCardProps) {
  const [amount, setAmount] = useState(String(request.amountPesewas / 100));
  const [method, setMethod] = useState<Received>(
    METHODS.some((m) => m.value === request.paymentMethod) ? (request.paymentMethod as Received) : 'cash'
  );
  const [reference, setReference] = useState(request.paymentReference ?? '');
  const [chequeCleared, setChequeCleared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const needsRef = method !== 'cash';
  const canConfirm = Number(amount) > 0 && !(needsRef && !reference.trim()) && !(method === 'cheque' && !chequeCleared);

  function run(action: () => Promise<void>, message: string) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        showToast(message);
        setResolved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      }
    });
  }

  function handleReject() {
    const note = window.prompt('Reason for not accepting this payment (the vendor will see it):', '');
    if (note === null) return;
    run(() => rejectRepaymentRequest(request.id, note), 'Payment not accepted');
  }

  if (resolved) return null;

  return (
    <div className="rounded-md border border-border-beige bg-surface-card p-5 text-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-ink">{vendor.name}</p>
          <p className="text-xs text-ink-muted">
            Submitted {new Date(request.createdAt).toLocaleString()} · currently owes {formatGHS(vendor.owedPesewas)}
          </p>
          {request.contactPhone && (
            <p className="mt-1 text-xs text-ink">
              Phone:{' '}
              <a href={`tel:${request.contactPhone}`} className="text-brand-green hover:underline">
                {request.contactPhone}
              </a>
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="font-medium text-ink">{formatGHS(request.amountPesewas)}</p>
          <p className="text-xs capitalize text-ink-muted">
            Says paid by {request.paymentMethod.replace('_', ' ')}
            {request.paymentReference ? ` · ${request.paymentReference}` : ''}
          </p>
        </div>
      </div>

      {request.notes && <p className="mb-3 text-xs text-ink-muted">Note: {request.notes}</p>}

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Amount actually received (GHS)
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded-md border border-brand-sage px-3 py-2 text-sm text-ink"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Received via
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as Received)}
            className="rounded-md border border-brand-sage px-3 py-2 text-sm text-ink"
          >
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

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

        {method === 'cheque' && (
          <label className="flex items-center gap-2 text-xs text-ink sm:col-span-2">
            <input type="checkbox" checked={chequeCleared} onChange={(e) => setChequeCleared(e.target.checked)} />
            The cheque has cleared
          </label>
        )}
      </div>

      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() =>
            run(
              () => confirmRepaymentRequest(request.id, Number(amount), method, reference, chequeCleared),
              'Payment confirmed — balance updated'
            )
          }
          disabled={isPending || !canConfirm}
          className="rounded-md bg-brand-green px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          {isPending ? 'Working…' : 'Confirm payment received'}
        </button>
        <button
          onClick={handleReject}
          disabled={isPending}
          className="rounded-md border border-accent-terracotta px-4 py-2 text-xs text-accent-terracotta disabled:opacity-50"
        >
          Not received
        </button>
      </div>
    </div>
  );
}