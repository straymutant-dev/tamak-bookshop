// STRAYMUTANT.DEV — Tamak Bookshop
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { CLASS_LEVELS } from '@/lib/types';
import BookCard from '@/components/store/BookCard';
import ScrollReveal from '@/components/ui/ScrollReveal';


export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; class_level?: string; category?: string; subject?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  let isVendor = false;
  let vendorApproved = false;
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role, vendor_status').eq('id', user.id).single();
    isVendor = profile?.role === 'vendor';
    vendorApproved = profile?.vendor_status === 'approved';
  }

  let query = supabase.from('books').select('*').order('title', { ascending: true });

  if (params.search) query = query.ilike('title', `%${params.search}%`);
  if (params.class_level) query = query.eq('class_level', params.class_level);
  if (params.category) query = query.eq('category', params.category);
  if (params.subject) query = query.eq('subject', params.subject);
  const { data: books, error } = await query;
  
 const { data: subjectRows } = await supabase.from('books').select('subject').eq('is_active', true).not('subject', 'is', null);
  const subjects = Array.from(new Set((subjectRows ?? []).map((r) => r.subject))).filter(Boolean) as string[];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="mb-6 font-serif text-3xl text-ink">Books catalog</h1>

      <form method="GET" className="mb-4 flex overflow-hidden rounded-md border border-brand-sage bg-surface-card">
        <input
          name="search"
          type="text"
          defaultValue={params.search ?? ''}
          placeholder="Search by title"
          className="w-full px-4 py-2.5 text-sm text-ink outline-none placeholder:text-ink-muted"
        />
        {params.class_level && <input type="hidden" name="class_level" value={params.class_level} />}
        <button type="submit" className="bg-brand-green px-5 text-sm font-medium text-white">
          Search
        </button>
      </form>



      <div className="mb-8 flex flex-wrap gap-2">
        <Link
          href="/store"
          className={`rounded-full border px-3 py-1 text-xs ${
            !params.class_level
              ? 'border-brand-green bg-brand-green text-white'
              : 'border-border-beige text-ink-muted hover:border-brand-sage'
          }`}
        >
          All levels
        </Link>
        {CLASS_LEVELS.map((level) => (
          <Link
            key={level}
            href={`/store?class_level=${encodeURIComponent(level)}${params.search ? `&search=${encodeURIComponent(params.search)}` : ''}`}
            className={`rounded-full border px-3 py-1 text-xs ${
              params.class_level === level
                ? 'border-brand-green bg-brand-green text-white'
                : 'border-border-beige text-ink-muted hover:border-brand-sage'
            }`}
          >
            {level}
          </Link>
        ))}
      </div>

      {subjects.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <Link
            href="/store"
            className={`rounded-full border px-3 py-1 text-xs ${
              !params.subject
                ? 'border-brand-green bg-brand-green text-white'
                : 'border-border-beige text-ink-muted hover:border-brand-sage'
            }`}
          >
            All subjects
          </Link>
          {subjects.map((subject) => (
            <Link
              key={subject}
              href={`/store?subject=${encodeURIComponent(subject)}${params.class_level ? `&class_level=${encodeURIComponent(params.class_level)}` : ''}`}
              className={`rounded-full border px-3 py-1 text-xs ${
                params.subject === subject
                  ? 'border-brand-green bg-brand-green text-white'
                  : 'border-border-beige text-ink-muted hover:border-brand-sage'
              }`}
            >
              {subject}
            </Link>
          ))}
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load books: {error.message}
        </p>
      )}

      <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 md:grid-cols-4">
        {(books ?? []).map((book, i) => (
          <ScrollReveal key={book.id} delay={Math.min(i * 40, 300)}>
            <BookCard book={book} isVendor={isVendor} vendorApproved={vendorApproved} />
          </ScrollReveal>
        ))}
        
        {(books ?? []).length === 0 && !error && (
          <p className="col-span-full py-12 text-center text-ink-muted">
            No books match your search yet.
          </p>
        )}
      </div>
    </div>
  );
}