// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

// Page numbers to show: always the first and last, plus the pages around the current one.
function visiblePages(page: number, pageCount: number): (number | 'gap')[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);

  const pages = new Set<number>([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);

  const result: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push('gap');
    result.push(p);
  });
  return result;
}

export default function Pagination({
  page,
  pageCount,
  onPageChange,
  disabled = false,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  if (pageCount <= 1) return null;

  const buttonBase =
    'flex h-9 min-w-9 items-center justify-center rounded-xl border px-2.5 text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green disabled:pointer-events-none disabled:opacity-40';

  return (
    <nav aria-label="Pagination" className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={disabled || page <= 1}
        aria-label="Previous page"
        className={`${buttonBase} border-border-beige bg-surface-card text-ink-muted hover:border-brand-green hover:bg-brand-green hover:text-white`}
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </button>

      {visiblePages(page, pageCount).map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} className="px-1 text-sm text-ink-muted">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            disabled={disabled}
            aria-label={`Go to page ${item}`}
            aria-current={item === page ? 'page' : undefined}
            className={`${buttonBase} ${
              item === page
                ? 'border-brand-green bg-brand-green font-medium text-white'
                : 'border-border-beige bg-surface-card text-ink-muted hover:border-brand-green hover:bg-brand-green hover:text-white'
            }`}
          >
            {item}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={disabled || page >= pageCount}
        aria-label="Next page"
        className={`${buttonBase} border-border-beige bg-surface-card text-ink-muted hover:border-brand-green hover:bg-brand-green hover:text-white`}
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </nav>
  );
}