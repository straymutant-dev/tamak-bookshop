// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useEffect, useRef, useState } from 'react';
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
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const image = imageRef.current;
    if (src && image?.complete && image.naturalWidth > 0) {
      const frame = window.requestAnimationFrame(() => setLoadedSrc(src));
      return () => window.cancelAnimationFrame(frame);
    }
  }, [src]);

  if (!src) return <div className={`bg-surface-cream ${className}`}><AsciiSkeleton variant="dither" rows={4} /></div>;

  const loaded = loadedSrc === src;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded && (
        <div className="absolute inset-0 bg-surface-cream">
          <AsciiSkeleton variant="dither" rows={4} />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoadedSrc(src)}
        className={`h-full w-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}