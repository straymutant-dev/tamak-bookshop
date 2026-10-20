// STRAYMUTANT.DEV — Tamak Bookshop
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import InventoryTable from './InventoryTable';
import { CLASS_LEVELS, type ClassLevel } from '@/lib/types';
import {
  INVENTORY_PAGE_SIZE,
  SORT_COLUMNS,
  parseDirection,
  parseSortKey,
} from './inventoryQuery';

type InventorySearchParams = {
  category?: string;
  subject?: string;
  class_level?: string;
  academic_year?: string;
  status?: string;
  q?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<InventorySearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const sort = parseSortKey(params.sort);
  const dir = parseDirection(params.dir);
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const from = (page - 1) * INVENTORY_PAGE_SIZE;
  const to = from + INVENTORY_PAGE_SIZE - 1;

  let query = supabase.from('books').select('*', { count: 'exact' });

  if (params.status === 'archived') query = query.eq('is_active', false);
  else query = query.eq('is_active', true);

  if (params.category) query = query.eq('category', params.category);
  if (params.subject) query = query.eq('subject', params.subject);
  if (params.class_level) query = query.eq('class_level', params.class_level as ClassLevel);
  if (params.academic_year) query = query.eq('academic_year', params.academic_year);

  // Search by title or author. Characters that mean something in a filter are replaced by spaces.
  const safeSearch = (params.q ?? '').replace(/[,()*%_\\]/g, ' ').trim();
  if (safeSearch) query = query.or(`title.ilike.%${safeSearch}%,author.ilike.%${safeSearch}%`);

  query = query.order(SORT_COLUMNS[sort], { ascending: dir === 'asc' });
  if (sort !== 'title') query = query.order('title', { ascending: true });

  const { data: books, error, count } = await query.range(from, to);

  // A page number past the end (for example after archiving the last book on a page): go back to page 1.
  if (error?.code === 'PGRST103' && page > 1) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== 'page') next.set(key, value);
    }
    redirect(`/admin/inventory?${next.toString()}`);
  }

  const totalCount = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / INVENTORY_PAGE_SIZE));

  const { data: categoryRows } = await supabase
    .from('books')
    .select('category')
    .not('category', 'is', null);
  const categories = Array.from(new Set((categoryRows ?? []).map((r) => r.category))).filter(
    Boolean
  ) as string[];

  const { data: subjectRows } = await supabase
    .from('books')
    .select('subject')
    .not('subject', 'is', null);
  const subjects = Array.from(new Set((subjectRows ?? []).map((r) => r.subject))).filter(Boolean) as string[];

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold text-ink">Inventory</h1>
        <p className="text-sm text-ink-muted">
          {totalCount} {totalCount === 1 ? 'book' : 'books'}
        </p>
      </div>

      {error && error.code !== 'PGRST103' && (
        <p className="mb-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          Failed to load books: {error.message}
        </p>
      )}

      <InventoryTable
        books={books ?? []}
        categories={categories}
        subjects={subjects}
        classLevels={CLASS_LEVELS}
        activeFilters={params}
        sort={sort}
        dir={dir}
        page={page}
        pageCount={pageCount}
        totalCount={totalCount}
      />
    </div>
  );
}