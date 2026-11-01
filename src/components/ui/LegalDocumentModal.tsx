// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';

export default function LegalDocumentModal({
  label,
  title,
  href,
  className = '',
}: {
  label: string;
  title: string;
  href: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className || 'text-left hover:text-brand-green hover:underline'}
      >
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex h-[92dvh] w-full flex-col rounded-t-2xl border border-border-beige bg-surface-card shadow-xl sm:h-[85vh] sm:max-w-3xl sm:rounded-2xl"
          >
            <header className="flex items-center justify-between border-b border-border-beige px-4 py-3 sm:px-5">
              <h2 id={titleId} className="font-serif text-lg text-brand-green sm:text-xl">{title}</h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label={`Close ${title}`}
                className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted hover:bg-surface-cream hover:text-ink"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            <iframe
              src={href}
              title={title}
              className="min-h-0 w-full flex-1 rounded-b-2xl bg-white"
            />
          </section>
        </div>
      )}
    </>
  );
}