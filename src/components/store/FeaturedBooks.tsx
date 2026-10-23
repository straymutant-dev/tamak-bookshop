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
    <section className="featured-books">
      <div className="featured-books__heading">
        <div>
          <p className="featured-books__eyebrow">A good place to start</p>
          <h2 className="font-serif text-3xl text-ink">Popular this term</h2>
        </div>
        <Link href="/store" className="featured-books__link">
          Explore the full catalog
          <span aria-hidden="true">↗</span>
        </Link>
      </div>

      <div className="featured-books__grid">
        {featured.map((book, i) => (
          <ScrollReveal key={book.id} delay={i * 60}>
            <Link href={`/store#book-${book.id}`} className="featured-books__card">
              <div className="featured-books__cover">
                <ImageWithSkeleton
                  src={book.cover_image_url}
                  alt={book.title}
                  className="aspect-3/4 w-full rounded-sm"
                />
                <span className="featured-books__cover-arrow" aria-hidden="true">↗</span>
              </div>
              <p className="featured-books__category">
                {[book.subject, book.class_level].filter(Boolean).join(' · ') || book.category || 'School book'}
              </p>
              <p className="featured-books__title">{book.title}</p>
              <p className="featured-books__price">{formatGHS(book.customer_price_pesewas)}</p>
            </Link>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}