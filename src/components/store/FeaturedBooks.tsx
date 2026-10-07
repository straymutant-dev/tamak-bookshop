// STRAYMUTANT.DEV — Tamak Bookshop
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatGHS } from '@/lib/currency';
import type { Book } from '@/lib/types';
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton';
import ScrollReveal from '@/components/ui/ScrollReveal';

const FEATURED_COUNT = 4;
const RECENT_LIMIT = 4;

function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default async function FeaturedBooks() {
  const supabase = await createClient();

  const { data } = await supabase
    .from('books')
    .select('*')
    .eq('is_active', true)
    .gt('stock_quantity', 0);

  const books = (data ?? []) as Book[];
  if (books.length === 0) return null;

  const byRecent = [...books].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
  const recent = byRecent.slice(0, RECENT_LIMIT);
  const recentIds = new Set(recent.map((b) => b.id));
  const rest = shuffle(books.filter((b) => !recentIds.has(b.id)));

  const featured = [...recent, ...rest].slice(0, FEATURED_COUNT);

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="font-serif text-2xl text-ink">Fast-moving this term</h2>
        <Link href="/store" className="text-sm text-brand-green hover:underline">
          View full catalog
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
        {featured.map((book, i) => (
          <ScrollReveal key={book.id} delay={i * 60}>
            <Link href={`/store#book-${book.id}`} className="block border-b border-border-beige pb-4">
              <ImageWithSkeleton
                src={book.cover_image_url}
                alt={book.title}
                className="mb-3 aspect-3/4 w-full rounded-sm"
              />
              <p className="text-sm font-medium text-ink">{book.title}</p>
              <p className="mt-1 text-xs text-ink-muted">
                {[book.subject, book.class_level].filter(Boolean).join(' · ') || book.category || '—'}
              </p>
              <p className="mt-1 text-sm text-ink">{formatGHS(book.customer_price_pesewas)}</p>
            </Link>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}