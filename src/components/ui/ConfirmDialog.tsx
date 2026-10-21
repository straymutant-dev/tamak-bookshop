// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useEffect, useId, useRef } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger = red button and warning icon, default = green button and question icon */
  tone?: 'danger' | 'default';
  /** disables the buttons and shows "Working…" while the action runs */
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cancelHandler = useRef(onCancel);
  const busyRef = useRef(busy);

  useEffect(() => {
    cancelHandler.current = onCancel;
    busyRef.current = busy;
  });

  // Focus the safe choice (Cancel) when the box opens, and let Escape close it.
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busyRef.current) cancelHandler.current();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  if (!open) return null;

  const danger = tone === 'danger';

  return (
    <div
      className="fixed inset-0 z-60 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="w-full max-w-sm rounded-2xl border border-border-beige bg-surface-card p-6 shadow-xl"
      >
        <div
          className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
            danger ? 'bg-accent-terracotta/10 text-accent-terracotta' : 'bg-brand-green/10 text-brand-green'
          }`}
        >
          {danger ? <AlertTriangle size={22} aria-hidden="true" /> : <HelpCircle size={22} aria-hidden="true" />}
        </div>

        <h2 id={titleId} className="font-serif text-xl text-brand-green">
          {title}
        </h2>
        <p id={bodyId} className="mt-2 text-sm text-ink-muted">
          {message}
        </p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-brand-sage px-4 py-2.5 text-sm font-medium text-ink disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60 ${
              danger ? 'bg-accent-terracotta' : 'bg-brand-green'
            }`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}