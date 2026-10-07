// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState } from 'react';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export default function TeamPhoto({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-md bg-brand-green font-serif text-2xl text-surface-cream">
        {getInitials(name)}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className="aspect-square w-full rounded-md object-cover"
      onError={() => setFailed(true)}
    />
  );
}