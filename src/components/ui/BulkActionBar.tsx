// STRAYMUTANT.DEV — Tamak Bookshop
import type { ReactNode } from 'react';

/** A bar pinned to the bottom of the screen that appears while rows are selected. */
export default function BulkActionBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: ReactNode;
}) {
  if (count <= 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-beige bg-surface-card px-4 py-3 shadow-lg"
      >
        <p className="text-sm text-ink">
          <span className="font-semibold text-brand-green tabular-nums">{count}</span>{' '}
          <span className="text-ink-muted">selected</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="rounded-xl px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink"
          >
            Clear
          </button>
          {children}
        </div>
      </div>
    </div>
  );
}