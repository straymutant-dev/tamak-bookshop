// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export default function BackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from');

  return (
    <button
      onClick={() => router.push(from || fallbackHref)}
      className="mb-6 inline-block text-sm text-ink-muted hover:text-brand-green"
    >
      ← Back
    </button>
  );
}