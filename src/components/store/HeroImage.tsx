// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState } from 'react';

export default function HeroImage({ className = '' }: { className?: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={`relative h-full w-full ${failed ? 'rounded-lg bg-brand-green' : ''} ${className}`}>
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/images/hero.webp"
          alt="Tamak Series Mathematics book"
          width={413}
          height={605}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}