// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { Book, ClassLevel } from '@/lib/types';
import { formatGHS } from '@/lib/currency';
import { INVENTORY_PAGE_SIZE, type InventorySortKey, type SortDirection } from './inventoryQuery';
import { deleteBook, markBookReviewed, restoreBook } from './actions';
import { useToast } from '@/components/ui/ToastContext';
import BookFormModal from './BookFormModal';
import StockAdjustModal from './StockAdjustModal';
import BookHistoryModal from './BookhistoryModal';
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton';
import AdminFilterDropdown from '@/components/admin/AdminFilterDropdown';


export default function InventoryTable({
  books,
  categories,
  subjects,
  classLevels,
  activeFilters,
  sort,
  dir,
  page,
  pageCount,
  totalCount,
}: {
  books: Book[];
  categories: string[];
  subjects: string[];
  classLevels: ClassLevel[];
  activeFilters: { category?: string; subject?: string; class_level?: string; academic_year?: string; status?: string };
  sort: InventorySortKey;
  dir: SortDirection;
  page: number;
  pageCount: number;
  totalCount: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editingBook, setEditingBook] = useState<Book | null | 'new'>(null);
  const [stockBook, setStockBook] = useState<Book | null>(null);
  const [historyBook, setHistoryBook] = useState<Book | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const { showToast } = useToast();

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    router.push(`/admin/inventory?${next.toString()}`);
  }

  function updateSort(key: InventorySortKey) {
    const next = new URLSearchParams(searchParams.toString());
    next.set('sort', key);
    next.set('dir', sort === key && dir === 'asc' ? 'desc' : 'asc');
    next.delete('page');
    router.push(`/admin/inventory?${next.toString()}`);
  }

  function updatePage(nextPage: number) {
    const next = new URLSearchParams(searchParams.toString());
    if (nextPage === 1) next.delete('page');
    else next.set('page', String(nextPage));
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

  async function handleReviewed(bookId: string) {
    setReviewingId(bookId);
    try {
      await markBookReviewed(bookId);
      showToast('Marked as reviewed');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not mark as reviewed');
    } finally {
      setReviewingId(null);
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
        <AdminFilterDropdown
          label="Filter by status"
          options={[
            { value: 'active', label: 'Active books' },
            { value: 'archived', label: 'Archived (deleted)' },
          ]}
          value={activeFilters.status ?? 'active'}
          onChange={(value) => updateFilter('status', value === 'active' ? '' : value)}
        />

        <AdminFilterDropdown
          label="Filter by class level"
          options={[
            { value: '', label: 'All class levels' },
            ...classLevels.map((classLevel) => ({ value: classLevel, label: classLevel })),
          ]}
          value={activeFilters.class_level ?? ''}
          onChange={(value) => updateFilter('class_level', value)}
        />

        <AdminFilterDropdown
          label="Filter by category"
          options={[
            { value: '', label: 'All categories' },
            ...categories.map((category) => ({ value: category, label: category })),
          ]}
          value={activeFilters.category ?? ''}
          onChange={(value) => updateFilter('category', value)}
        />

        <AdminFilterDropdown
          label="Filter by subject"
          options={[
            { value: '', label: 'All subjects' },
            ...subjects.map((subject) => ({ value: subject, label: subject })),
          ]}
          value={activeFilters.subject ?? ''}
          onChange={(value) => updateFilter('subject', value)}
        />

        <input
          placeholder="Academic year"
          defaultValue={activeFilters.academic_year ?? ''}
          onBlur={(e) => updateFilter('academic_year', e.target.value)}
          className="inventory-filter-input"
        />

        <div className="ml-auto flex items-center gap-2">
          <a
            href={`/admin/inventory/export?${searchParams.toString()}`}
            className="rounded-md border border-brand-sage px-4 py-2 text-sm font-medium text-ink hover:bg-surface-cream"
          >
            Download PDF
          </a>
          <button
            onClick={() => setEditingBook('new')}
            className="rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white"
          >
            Add book
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border-beige bg-surface-card">
        <table className="w-full text-sm">
          <thead className="bg-surface-cream text-left text-ink-muted">
            <tr>
              <th className="px-4 py-3">Cover</th>
              {([
                ['title', 'Title'],
                ['category', 'Category / Level'],
                ['retail', 'Retail'],
                ['wholesale', 'Wholesale'],
                ['stock', 'Stock'],
              ] as const).map(([key, label]) => (
                <th key={key} className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => updateSort(key)}
                    aria-label={`Sort by ${label}${sort === key ? `, currently ${dir}ending` : ''}`}
                    className="inline-flex items-center gap-1 hover:text-ink"
                  >
                    {label}
                    {sort === key ? (
                      dir === 'asc' ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />
                    ) : (
                      <ArrowUpDown size={14} aria-hidden="true" />
                    )}
                  </button>
                </th>
              ))}
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
                  <div className="flex items-center gap-2 font-medium text-ink">
                    {book.title}
                    {book.status === 'updated' && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-800">
                        Updated
                      </span>
                    )}
                  </div>
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
                    <button onClick={() => setHistoryBook(book)} className="text-ink-muted">
                      History
                    </button>
                    {book.is_active && book.status === 'updated' && (
                      <button
                        onClick={() => handleReviewed(book.id)}
                        disabled={reviewingId === book.id}
                        className="text-brand-green disabled:opacity-50"
                      >
                        {reviewingId === book.id ? 'Saving…' : 'Mark reviewed'}
                      </button>
                    )}
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

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-muted">
        <span>
          Showing {totalCount === 0 ? 0 : (page - 1) * INVENTORY_PAGE_SIZE + 1}–
          {Math.min(page * INVENTORY_PAGE_SIZE, totalCount)} of {totalCount}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => updatePage(page - 1)}
            disabled={page <= 1}
            className="rounded-md border border-brand-sage px-3 py-1.5 disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {page} of {pageCount}
          </span>
          <button
            type="button"
            onClick={() => updatePage(page + 1)}
            disabled={page >= pageCount}
            className="rounded-md border border-brand-sage px-3 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {editingBook && (
        <BookFormModal
          book={editingBook === 'new' ? null : editingBook}
          classLevels={classLevels}
          onClose={() => setEditingBook(null)}
        />
      )}

      {stockBook && <StockAdjustModal book={stockBook} onClose={() => setStockBook(null)} />}

      {historyBook && <BookHistoryModal book={historyBook} onClose={() => setHistoryBook(null)} />}
    </div>
  );
}