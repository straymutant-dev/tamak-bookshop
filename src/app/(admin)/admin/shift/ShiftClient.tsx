// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState, useTransition } from 'react';
import { formatGHS } from '@/lib/currency';
import { openShift, closeShift } from './actions';
import { useToast } from '@/components/ui/ToastContext';

interface OpenShift {
  id: string;
  opened_at: string;
  opening_cash_pesewas: number;
}

export default function ShiftClient({ openShift: currentShift }: { openShift: OpenShift | null }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  function handleOpen(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await openShift(formData);
        showToast('Shift opened');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      }
    });
  }

  function handleClose(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await closeShift(formData);
        showToast('Shift closed');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      }
    });
  }

  if (currentShift) {
    return (
      <div className="max-w-md rounded-md border border-border-beige bg-surface-card p-5">
        <p className="mb-1 text-sm text-ink-muted">
          Shift opened {new Date(currentShift.opened_at).toLocaleString()}
        </p>
        <p className="mb-4 text-sm text-ink-muted">Opening cash: {formatGHS(currentShift.opening_cash_pesewas)}</p>

        {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <form action={handleClose} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Actual cash counted (GHS)
            <input
              name="actualCash"
              type="number"
              step="0.01"
              min="0"
              required
              className="rounded-md border border-brand-sage px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Notes (optional)
            <textarea name="notes" rows={2} className="rounded-md border border-brand-sage px-3 py-2" />
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-accent-terracotta px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending ? 'Closing…' : 'Close shift'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-md rounded-md border border-border-beige bg-surface-card p-5">
      <p className="mb-4 text-sm text-ink-muted">You don&rsquo;t have an open shift.</p>

      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      <form action={handleOpen} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Opening cash (GHS)
          <input
            name="openingCash"
            type="number"
            step="0.01"
            min="0"
            required
            className="rounded-md border border-brand-sage px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? 'Opening…' : 'Open shift'}
        </button>
      </form>
    </div>
  );
}