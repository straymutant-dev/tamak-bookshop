// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import Image from 'next/image';
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
    <Image
      src="/images/logo.webp"
      alt="Tamak Bookshop"
      width={600}
      height={144}
      sizes="250px"
      loading="eager"
      quality={75}
      className={`w-auto shrink-0 object-contain ${className}`}
      onError={() => setFailed(true)}
    />
  );
}