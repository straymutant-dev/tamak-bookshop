// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useEffect, useRef, useState } from 'react';

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

  if (!src) return <div className={`animate-pulse bg-surface-cream ${className}`} />;

  const loaded = loadedSrc === src;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-surface-cream" />}
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