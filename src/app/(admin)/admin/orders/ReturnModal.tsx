// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useEffect, useState, useTransition } from 'react';
import { formatGHS } from '@/lib/currency';
import { useToast } from '@/components/ui/ToastContext';
import type { ReturnInfo, ReturnResult } from '@/lib/returns';
import { getReturnInfo, processReturn } from './returnActions';

type Condition = 'resellable' | 'damaged';

export default function ReturnModal({
  order,
  onClose,
}: {
  order: { id: string; order_number: string; payment_method: string };
  onClose: () => void;
}) {
  const [info, setInfo] = useState<ReturnInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [conditions, setConditions] = useState<Record<string, Condition>>({});
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    getReturnInfo(order.id)
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load this order');
      });
    return () => {
      cancelled = true;
    };
  }, [order.id]);

  const returnable = (info?.items ?? []).filter((item) => item.remaining > 0);
  const estimate = returnable.reduce((sum, item) => sum + (quantities[item.bookId] ?? 0) * item.unitRefundPesewas, 0);
  const anySelected = returnable.some((item) => (quantities[item.bookId] ?? 0) > 0);
  const paidWith = order.payment_method.replace('_', ' ');

  function setQty(bookId: string, max: number, raw: string) {
    const n = Math.max(0, Math.min(max, Math.floor(Number(raw) || 0)));
    setQuantities((q) => ({ ...q, [bookId]: n }));
  }

  function handleSubmit() {
    if (!info) return;
    setError(null);
    startTransition(async () => {
      try {
        const items = returnable
          .filter((item) => (quantities[item.bookId] ?? 0) > 0)
          .map((item) => ({
            bookId: item.bookId,
            quantity: quantities[item.bookId],
            condition: conditions[item.bookId] ?? ('resellable' as Condition),
          }));
        const res = await processReturn(order.id, items, notes);
        setResult(res);
        showToast('Return recorded');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-surface-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-ink">Return items — {order.order_number}</h2>

        {loadError && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>}

        {!info && !loadError && <p className="text-sm text-ink-muted">Loading…</p>}

        {result && (
          <div className="flex flex-col gap-3 text-sm">
            <p className="rounded-md bg-surface-cream px-3 py-2 text-ink">
              Return recorded. Refund value: <span className="font-medium">{formatGHS(result.refundPesewas)}</span>
            </p>
            {result.creditAppliedPesewas > 0 && (
              <p className="text-ink">
                {formatGHS(result.creditAppliedPesewas)} has been taken off what this customer owes.
              </p>
            )}
            {result.cashRefundPesewas > 0 ? (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-ink">
                Hand back <span className="font-medium">{formatGHS(result.cashRefundPesewas)}</span> to the customer
                (they paid by {paidWith}).
              </p>
            ) : (
              <p className="text-ink-muted">Nothing to hand back.</p>
            )}
            <div className="mt-2 flex justify-end">
              <button onClick={onClose} className="rounded-md bg-brand-green px-4 py-2 font-medium text-white">
                Done
              </button>
            </div>
          </div>
        )}

        {info && !result && info.blockedReason && (
          <div className="flex flex-col gap-4">
            <p className="rounded-md bg-surface-cream px-3 py-2 text-sm text-ink">{info.blockedReason}</p>
            <div className="flex justify-end">
              <button onClick={onClose} className="rounded-md border border-brand-sage px-4 py-2 text-sm text-ink">
                Close
              </button>
            </div>
          </div>
        )}

        {info && !result && !info.blockedReason && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-ink-muted">
              Returns are accepted until {new Date(info.deadline).toLocaleDateString()}. Resellable copies go back on the
              shelf; damaged ones are counted as damaged stock.
            </p>

            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <div className="flex flex-col gap-3">
              {returnable.map((item) => (
                <div key={item.bookId} className="rounded-md border border-border-beige p-3 text-sm">
                  <div className="font-medium text-ink">{item.title}</div>
                  <div className="mb-2 text-xs text-ink-muted">
                    Bought {item.sold}
                    {item.returned > 0 ? ` · already returned ${item.returned}` : ''} · about{' '}
                    {formatGHS(item.unitRefundPesewas)} each
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-ink-muted">
                      Return
                      <input
                        type="number"
                        min={0}
                        max={item.remaining}
                        value={quantities[item.bookId] ?? 0}
                        onChange={(e) => setQty(item.bookId, item.remaining, e.target.value)}
                        className="w-16 rounded-md border border-brand-sage px-2 py-1 text-sm text-ink"
                      />
                      <span>of {item.remaining}</span>
                    </label>
                    <select
                      value={conditions[item.bookId] ?? 'resellable'}
                      onChange={(e) =>
                        setConditions((c) => ({ ...c, [item.bookId]: e.target.value as Condition }))
                      }
                      className="rounded-md border border-brand-sage px-2 py-1 text-sm text-ink"
                    >
                      <option value="resellable">Resellable</option>
                      <option value="damaged">Damaged</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <label className="flex flex-col gap-1 text-sm">
              Note (optional)
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. wrong edition bought"
                className="rounded-md border border-brand-sage px-3 py-2"
              />
            </label>

            <p className="text-sm text-ink">
              Estimated refund: <span className="font-medium">{formatGHS(estimate)}</span>
              <span className="block text-xs text-ink-muted">
                The exact amount is worked out when you confirm, from what was actually paid.
              </span>
            </p>

            <div className="flex justify-end gap-3">
              <button onClick={onClose} className="rounded-md border border-brand-sage px-4 py-2 text-sm text-ink">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!anySelected || isPending}
                className="rounded-md bg-brand-green px-4 py-2 font-medium text-white disabled:opacity-50"
              >
                {isPending ? 'Recording…' : 'Confirm return'}
              </button>
            </div>
          </div>
        )}

        {!result && !info?.blockedReason && !info && loadError && (
          <div className="mt-4 flex justify-end">
            <button onClick={onClose} className="rounded-md border border-brand-sage px-4 py-2 text-sm text-ink">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}