// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function MobileDrawer({
  open,
  onClose,
  children,
  restrictToMobile = true,
  label = 'Navigation menu',
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  restrictToMobile?: boolean;
  label?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousOverflow = document.body.style.overflow;
    if (open) {
      if (!dialog.open) dialog.showModal();
      document.body.style.overflow = 'hidden';
      closeButtonRef.current?.focus();
    } else {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
    }

    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={`fixed inset-0 z-50 m-0 h-dvh w-screen max-h-none max-w-none overflow-hidden border-0 bg-transparent p-0 ${restrictToMobile ? 'md:hidden' : ''}`}
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <button
        type="button"
        aria-label="Dismiss menu"
        tabIndex={-1}
        onClick={onClose}
        className={`glass-backdrop absolute inset-0 bg-ink/40 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        className={`glass-drawer absolute right-0 top-0 flex h-full w-72 max-w-[80%] flex-col bg-surface-card shadow-xl transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex justify-end px-4 py-4">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="text-ink"
          >
            <X size={22} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-6">{children}</div>
      </div>
    </dialog>
  );
}