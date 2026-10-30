'use client';

import { useEffect, useId, useState } from 'react';
import { Download, Eye, X } from 'lucide-react';
import { AsciiSkeleton } from 'ascii-reveal';

export default function VendorStatementPreview({
  vendorId,
  allVendors = false,
  label,
  className = '',
}: {
  vendorId?: string;
  allVendors?: boolean;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const titleId = useId();
  const downloadUrl =
    allVendors || !vendorId
      ? '/admin/vendors/statement'
      : `/admin/vendors/statement?vendor=${encodeURIComponent(vendorId)}`;
  const previewUrl = `${downloadUrl}${downloadUrl.includes('?') ? '&' : '?'}preview=1`;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPdfLoaded(false);
          setOpen(true);
        }}
        className={className}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Eye size={15} aria-hidden="true" />
        <span>{label}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/60 p-2 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex h-[calc(100vh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border-beige bg-surface-card shadow-2xl sm:h-[calc(100vh-3rem)]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border-beige px-4 py-3 sm:px-5">
              <h2 id={titleId} className="font-serif text-lg font-semibold text-ink">
                Unpaid books statement
              </h2>
              <div className="flex items-center gap-2">
                <a
                  href={downloadUrl}
                  download
                  className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-brand-green px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-green-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
                >
                  <Download size={16} aria-hidden="true" />
                  Download PDF
                </a>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-xl text-ink-muted transition-colors hover:bg-brand-green hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
                  aria-label="Close PDF preview"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="relative min-h-0 flex-1 bg-white">
              {!pdfLoaded && (
                <div className="absolute inset-0 z-10 grid place-items-center bg-surface-cream" role="status" aria-label="Loading PDF preview">
                  <div className="w-full max-w-2xl px-8">
                    <div className="mb-8 grid grid-cols-3 gap-4">
                      {Array.from({ length: 3 }, (_, index) => (
                        <AsciiSkeleton key={index} variant="dither" rows={3} />
                      ))}
                    </div>
                    <AsciiSkeleton variant="dither" lines={12} />
                  </div>
                </div>
              )}
              <iframe
                src={previewUrl}
                title="Unpaid books PDF preview"
                className="h-full w-full border-0"
                onLoad={() => setPdfLoaded(true)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
