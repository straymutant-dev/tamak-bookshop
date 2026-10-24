// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState, useTransition } from 'react';
import type { Book } from '@/lib/types';
import { intakeStock, returnStockToPublisher, writeOffStock } from './actions';
import { useToast } from '@/components/ui/ToastContext';

export default function StockAdjustModal({ book, onClose }: { book: Book; onClose: () => void }) {
  const [mode, setMode] = useState<'intake' | 'writeoff' | 'return'>('intake');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set('bookId', book.id);
    startTransition(async () => {
      try {
        if (mode === 'intake') await intakeStock(formData);
        else if (mode === 'writeoff') await writeOffStock(formData);
        else await returnStockToPublisher(formData);
        showToast(
          mode === 'intake'
            ? 'Stock added successfully'
            : mode === 'writeoff'
              ? 'Stock written off successfully'
              : 'Stock returned to publisher'
        );
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-surface-card p-6">
        <h2 className="mb-1 text-lg font-semibold text-ink">Adjust stock</h2>
        <p className="mb-4 text-sm text-ink-muted">
          {book.title} — currently {book.stock_quantity} in stock
        </p>

        <div className="mb-4 grid grid-cols-3 rounded-md border border-brand-sage p-1">
          <button
            type="button"
            onClick={() => setMode('intake')}
            aria-pressed={mode === 'intake'}
            className={`rounded px-2 py-2 text-xs font-medium sm:text-sm ${
              mode === 'intake' ? 'bg-brand-green text-white' : 'text-ink'
            }`}
          >
            Add stock
          </button>
          <button
            type="button"
            onClick={() => setMode('writeoff')}
            aria-pressed={mode === 'writeoff'}
            className={`rounded px-2 py-2 text-xs font-medium sm:text-sm ${
              mode === 'writeoff' ? 'bg-accent-terracotta text-white' : 'text-ink'
            }`}
          >
            Write off
          </button>
          <button
            type="button"
            onClick={() => setMode('return')}
            aria-pressed={mode === 'return'}
            className={`rounded px-2 py-2 text-xs font-medium sm:text-sm ${
              mode === 'return' ? 'bg-accent-terracotta text-white' : 'text-ink'
            }`}
          >
            Return to publisher
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <form action={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Quantity
            <input
              name="quantity"
              type="number"
              min="1"
              required
              className="rounded-md border border-brand-sage px-3 py-2"
            />
          </label>

          {mode === 'intake' ? (
            <label className="flex flex-col gap-1 text-sm">
              Note (optional)
              <input name="note" className="rounded-md border border-brand-sage px-3 py-2" />
            </label>
          ) : mode === 'writeoff' ? (
            <label className="flex flex-col gap-1 text-sm">
              Reason
              <input
                name="reason"
                required
                placeholder="Water damage, torn cover, etc."
                className="rounded-md border border-brand-sage px-3 py-2"
              />
            </label>
          ) : (
            <>
              <p className="text-xs text-ink-muted">
                Returned copies will be removed from available stock.
              </p>
              <label className="flex flex-col gap-1 text-sm">
                Note (optional)
                <input
                  name="note"
                  placeholder="Return reference or details"
                  className="rounded-md border border-brand-sage px-3 py-2"
                />
              </label>
            </>
          )}

          <div className="mt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-brand-sage px-4 py-2 text-sm text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isPending ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}