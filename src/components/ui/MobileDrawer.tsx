// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function MobileDrawer({
  open,
  onClose,
  children,
  restrictToMobile = true,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  restrictToMobile?: boolean;
}) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
        <div
      className={`fixed inset-0 z-50 ${restrictToMobile ? 'md:hidden' : ''} ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      
      <button
        aria-label="Close menu"
        onClick={onClose}
        className={`absolute inset-0 bg-ink/40 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        className={`absolute right-0 top-0 flex h-full w-72 max-w-[80%] flex-col bg-surface-card shadow-xl transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex justify-end px-4 py-4">
          <button onClick={onClose} aria-label="Close menu" className="text-ink">
            <X size={22} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-6">{children}</div>
      </div>
    </div>
  );
}