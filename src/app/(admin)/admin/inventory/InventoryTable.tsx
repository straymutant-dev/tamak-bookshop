// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Book, ClassLevel } from '@/lib/types';
import { formatGHS } from '@/lib/currency';
import { deleteBook, restoreBook } from './actions';
import { useToast } from '@/components/ui/ToastContext';
import BookFormModal from './BookFormModal';
import StockAdjustModal from './StockAdjustModal';
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton';


export default function InventoryTable({
  books,
  categories,
  subjects,
  classLevels,
  activeFilters,
}: {
  books: Book[];
  categories: string[];
  subjects: string[];
  classLevels: ClassLevel[];
  activeFilters: { category?: string; subject?: string; class_level?: string; academic_year?: string; status?: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editingBook, setEditingBook] = useState<Book | null | 'new'>(null);
  const [stockBook, setStockBook] = useState<Book | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const { showToast } = useToast();

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/admin/inventory?${next.toString()}`);
  }

  async function handleDelete(bookId: string) {
    if (!confirm('Delete this book? It can be restored later from the Archived filter.')) return;
    setDeletingId(bookId);
    try {
      await deleteBook(bookId);
      showToast('Book deleted');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRestore(bookId: string) {
    setRestoringId(bookId);
    try {
      await restoreBook(bookId);
      showToast('Book restored');
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <select
          defaultValue={activeFilters.status ?? 'active'}
          onChange={(e) => updateFilter('status', e.target.value === 'active' ? '' : e.target.value)}
          className="rounded-md border border-brand-sage px-3 py-2 text-sm"
        >
          <option value="active">Active books</option>
          <option value="archived">Archived (deleted)</option>
        </select>

        <select
          defaultValue={activeFilters.class_level ?? ''}
          onChange={(e) => updateFilter('class_level', e.target.value)}
          className="rounded-md border border-brand-sage px-3 py-2 text-sm"
        >
          <option value="">All class levels</option>
          {classLevels.map((lvl) => (
            <option key={lvl} value={lvl}>
              {lvl}
            </option>
          ))}
        </select>

        <select
          defaultValue={activeFilters.category ?? ''}
          onChange={(e) => updateFilter('category', e.target.value)}
          className="rounded-md border border-brand-sage px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          defaultValue={activeFilters.subject ?? ''}
          onChange={(e) => updateFilter('subject', e.target.value)}
          className="rounded-md border border-brand-sage px-3 py-2 text-sm"
        >
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <input
          placeholder="Academic year"
          defaultValue={activeFilters.academic_year ?? ''}
          onBlur={(e) => updateFilter('academic_year', e.target.value)}
          className="rounded-md border border-brand-sage px-3 py-2 text-sm"
        />

        <button
          onClick={() => setEditingBook('new')}
          className="ml-auto rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white"
        >
          Add book
        </button>
      </div>

      <div className="overflow-x-auto rounded-md border border-border-beige bg-surface-card">
        <table className="w-full text-sm">
          <thead className="bg-surface-cream text-left text-ink-muted">
            <tr>
              <th className="px-4 py-3">Cover</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Category / Level</th>
              <th className="px-4 py-3">Retail</th>
              <th className="px-4 py-3">Wholesale</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {books.map((book) => (
              <tr key={book.id} className="border-t border-border-beige">
               
                <td className="px-4 py-3">
                  <ImageWithSkeleton src={book.cover_image_url} alt={book.title} className="h-12 w-9 rounded" />
                </td>
                
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">{book.title}</div>
                  <div className="text-xs text-ink-muted">{book.author}</div>
                </td>
                <td className="px-4 py-3 text-ink-muted">
                  {book.category ?? '—'} . {book.subject ?? '—'} . {book.class_level ?? '—'}
                </td>
                <td className="px-4 py-3">{formatGHS(book.customer_price_pesewas)}</td>
                <td className="px-4 py-3">{formatGHS(book.vendor_price_pesewas)}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      book.stock_quantity <= 5
                        ? 'font-medium text-accent-terracotta'
                        : 'text-ink'
                    }
                  >
                    {book.stock_quantity}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-3 text-xs">
                    {book.is_active ? (
                      <>
                        <button onClick={() => setStockBook(book)} className="text-brand-green">
                          Adjust stock
                        </button>
                        <button onClick={() => setEditingBook(book)} className="text-accent-gold">
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(book.id)}
                          disabled={deletingId === book.id}
                          className="text-accent-terracotta disabled:opacity-50"
                        >
                          {deletingId === book.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleRestore(book.id)}
                        disabled={restoringId === book.id}
                        className="text-brand-green disabled:opacity-50"
                      >
                        {restoringId === book.id ? 'Restoring…' : 'Restore'}
                      </button>
                    )}
                  </div>
                </td>
                
              </tr>
            ))}
            {books.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-muted">
                  No books match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingBook && (
        <BookFormModal
          book={editingBook === 'new' ? null : editingBook}
          classLevels={classLevels}
          onClose={() => setEditingBook(null)}
        />
      )}

      {stockBook && <StockAdjustModal book={stockBook} onClose={() => setStockBook(null)} />}
    </div>
  );
}