// STRAYMUTANT.DEV — Tamak Bookshop
import { createClient } from '@/lib/supabase/server';
import InventoryTable from './InventoryTable';
import { CLASS_LEVELS, type ClassLevel } from '@/lib/types';

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; subject?: string; class_level?: string; academic_year?: string; status?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase.from('books').select('*').order('title', { ascending: true });

  if (params.status === 'archived') query = query.eq('is_active', false);
  else query = query.eq('is_active', true);

  if (params.category) query = query.eq('category', params.category);
  if (params.subject) query = query.eq('subject', params.subject);
  if (params.class_level) query = query.eq('class_level', params.class_level as ClassLevel);
  if (params.academic_year) query = query.eq('academic_year', params.academic_year);

  const { data: books, error } = await query;

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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">Inventory</h1>
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load books: {error.message}
        </p>
      )}

      <InventoryTable
        books={books ?? []}
        categories={categories}
        subjects={subjects}
        classLevels={CLASS_LEVELS}
        activeFilters={params}
      />
    </div>
  );
}