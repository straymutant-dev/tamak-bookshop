// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState } from 'react';

export default function BrandMark({ className = 'h-9' }: { className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className={`flex shrink-0 items-center gap-2 ${className}`}>
        <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-brand-green font-serif text-sm text-surface-cream">
          T
        </span>
        <span className="font-serif text-lg text-ink">Tamak Bookshop</span>
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/logo.png"
      alt="Tamak Bookshop"
      className={`w-auto shrink-0 object-contain ${className}`}
      onError={() => setFailed(true)}
    />
  );
}