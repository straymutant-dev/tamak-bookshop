// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useEffect, useState } from 'react';
import type { Book } from '@/lib/types';
import { ACTION_LABELS, describeChange } from '@/lib/bookChanges';
import { getBookHistory, type BookHistoryEntry } from './actions';

export default function BookHistoryModal({ book, onClose }: { book: Book; onClose: () => void }) {
  const [entries, setEntries] = useState<BookHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBookHistory(book.id)
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the history');
      });
    return () => {
      cancelled = true;
    };
  }, [book.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg bg-surface-card p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">History</h2>
            <p className="text-sm text-ink-muted">{book.title}</p>
          </div>
          <button onClick={onClose} className="rounded-md border border-brand-sage px-3 py-1 text-sm text-ink">
            Close
          </button>
        </div>

        <div className="overflow-y-auto">
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {!entries && !error && <p className="text-sm text-ink-muted">Loading…</p>}
          {entries && entries.length === 0 && (
            <p className="text-sm text-ink-muted">
              No changes recorded yet. Changes made before this feature was added are not in the history.
            </p>
          )}

          <ol className="flex flex-col gap-4">
            {entries?.map((entry) => (
              <li key={entry.id} className="border-t border-border-beige pt-3 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-sm font-medium text-ink">{ACTION_LABELS[entry.action] ?? entry.action}</span>
                  <span className="text-xs text-ink-muted">
                    {new Date(entry.changedAt).toLocaleString('en-GH', {
                      timeZone: 'Africa/Accra',
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
                <p className="text-xs text-ink-muted">by {entry.editor ?? 'the database (no signed-in user)'}</p>

                {entry.action !== 'created' && (
                  <ul className="mt-2 flex flex-col gap-1 text-xs">
                    {Object.entries(entry.changes).map(([field, change]) => {
                      const d = describeChange(field, change);
                      return (
                        <li key={field}>
                          <span className="text-ink-muted">{d.label}: </span>
                          <span className="text-ink-muted line-through">{d.before}</span>
                          <span className="text-ink-muted"> → </span>
                          <span className="font-medium text-ink">{d.after}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {entry.note && <p className="mt-1 text-xs text-ink-muted">Note: {entry.note}</p>}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}