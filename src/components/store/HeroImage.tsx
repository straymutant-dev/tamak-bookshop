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
          src="/images/hero.png"
          alt="Tamak Series Mathematics book"
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}