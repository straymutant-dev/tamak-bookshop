// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import Image from 'next/image';
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
    <Image
      src={src}
      alt={name}
      width={400}
      height={400}
      sizes="(max-width: 768px) 50vw, 25vw"
      quality={75}
      className="aspect-square w-full rounded-md object-cover"
      onError={() => setFailed(true)}
    />
  );
}