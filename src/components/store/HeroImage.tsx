// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState } from 'react';

export default function HeroImage({ className = '' }: { className?: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={`relative h-full w-full overflow-hidden rounded-lg bg-brand-green ${className}`}>
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/images/hero.png"
          alt="Students with textbooks at Tamak Bookshop"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background: failed
            ? 'linear-gradient(160deg, #164A41 0%, #5E8C61 100%)'
            : 'linear-gradient(160deg, rgba(22,74,65,0.55) 0%, rgba(22,74,65,0.05) 60%)',
        }}
      />
    </div>
  );
}