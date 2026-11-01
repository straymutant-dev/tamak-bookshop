// STRAYMUTANT.DEV — Tamak Bookshop
import type { Metadata } from 'next';
import Link from 'next/link';
import BrandMark from '@/components/store/BrandMark';

export const metadata: Metadata = {
  title: 'Page not found',
  description: 'The page you requested could not be found.',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-cream px-6 py-16">
      <section className="w-full max-w-md rounded-md border border-border-beige bg-surface-card p-8 text-center shadow-card">
        <Link href="/" className="inline-flex" aria-label="Tamak Bookshop home">
          <BrandMark className="h-8" />
        </Link>
        <p className="mt-8 text-sm font-medium uppercase tracking-[0.2em] text-brand-green">404</p>
        <h1 className="mt-2 font-serif text-3xl text-ink">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          The page may have moved, or the link you followed may be incorrect.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-brand-green px-5 text-sm font-medium text-white transition hover:bg-brand-green-dark"
        >
          Return to storefront
        </Link>
      </section>
    </main>
  );
}
