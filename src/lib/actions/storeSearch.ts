// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { createClient } from '@/lib/supabase/server';

export interface BookPreview {
  id: string;
  title: string;
  class_level: string | null;
  subject: string | null;
  stock_quantity: number;
  cover_image_url: string | null;
}

/** A handful of matching books for the storefront search dropdown (title match, active books only). */
export async function searchBooksPreview(query: string): Promise<BookPreview[]> {
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];

  // Escape LIKE wildcards so "50%" or "a_b" are searched literally.
  const pattern = q.replace(/[\\%_]/g, '\\$&');

  const supabase = await createClient();
  const { data } = await supabase
    .from('books')
    .select('id, title, class_level, subject, stock_quantity, cover_image_url')
    .eq('is_active', true)
    .ilike('title', `%${pattern}%`)
    .order('title', { ascending: true })
    .limit(6);

  return data ?? [];
}