// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState } from 'react';
import Image from 'next/image';

export default function HeroImage({ className = '' }: { className?: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={`relative h-full w-full ${failed ? 'rounded-lg bg-brand-green' : ''} ${className}`}>
      {!failed && (
        <Image
          src="/images/hero.webp"
          alt="Tamak Series Mathematics book"
          fill
          sizes="(max-width: 768px) 65vw, 42vw"
          quality={75}
          loading="eager"
          fetchPriority="high"
          className="object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}