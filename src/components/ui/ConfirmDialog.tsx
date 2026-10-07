// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-surface-card p-6">
        <h2 className="mb-2 text-lg font-semibold text-ink">{title}</h2>
        <p className="mb-6 text-sm text-ink-muted">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-md border border-brand-sage px-4 py-2 text-sm text-ink">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-accent-terracotta px-4 py-2 text-sm font-medium text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}