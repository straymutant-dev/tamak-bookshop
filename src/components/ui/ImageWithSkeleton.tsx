// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import Image from 'next/image';
import { useState } from 'react';
import { AsciiSkeleton } from 'ascii-reveal';

export default function ImageWithSkeleton({
  src,
  alt,
  className = '',
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const [imageState, setImageState] = useState<{
    src: string;
    status: 'loaded' | 'failed';
  } | null>(null);

  if (!src) return <div className={`bg-surface-cream ${className}`}><AsciiSkeleton variant="dither" rows={4} /></div>;

  const loaded = imageState?.src === src && imageState.status === 'loaded';
  const failed = imageState?.src === src && imageState.status === 'failed';

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {(!loaded || failed) && (
        <div className="absolute inset-0 bg-surface-cream">
          <AsciiSkeleton variant="dither" rows={4} />
        </div>
      )}
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
        quality={75}
        onLoad={() => setImageState({ src, status: 'loaded' })}
        onError={() => setImageState({ src, status: 'failed' })}
        className={`h-full w-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}