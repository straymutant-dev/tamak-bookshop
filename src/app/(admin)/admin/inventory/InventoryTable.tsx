// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowDown, ArrowUp, ArrowUpDown, BookOpen, Search } from 'lucide-react';
import type { Book, ClassLevel } from '@/lib/types';
import { formatGHS } from '@/lib/currency';
import { bulkSetBooksActive, deleteBook, restoreBook } from './actions';
import { useToast } from '@/components/ui/ToastContext';
import BookFormModal from './BookFormModal';
import StockAdjustModal from './StockAdjustModal';
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import BulkActionBar from '@/components/ui/BulkActionBar';
import { INVENTORY_PAGE_SIZE, type InventorySortKey, type SortDirection } from './inventoryQuery';

type ActiveFilters = {
  category?: string;
  subject?: string;
  class_level?: string;
  academic_year?: string;
  status?: string;
  q?: string;
};

function SortHeader({
  label,
  column,
  sort,
  dir,
  onSort,
}: {
  label: string;
  column: InventorySortKey;
  sort: InventorySortKey;
  dir: SortDirection;
  onSort: (column: InventorySortKey) => void;
}) {
  const active = sort === column;
  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown;

  return (
    <th
      className="px-4 py-3"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 hover:text-ink ${active ? 'text-ink' : ''}`}
        aria-label={`Sort by ${label}`}
      >
        {label}
        <Icon size={14} aria-hidden="true" />
      </button>
    </th>
  );
}

function SelectCheckbox({
  checked,
  indeterminate = false,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      aria-label={label}
      className="size-4 rounded border-brand-sage accent-brand-green disabled:opacity-40"
    />
  );
}

function SkeletonRow() {
  return (
    <tr className="border-t border-border-beige" aria-hidden="true">
      <td className="px-4 py-3">
        <span className="block size-4 animate-pulse rounded bg-border-beige" />
      </td>
      <td className="px-4 py-3">
        <span className="block h-12 w-9 animate-pulse rounded bg-border-beige" />
      </td>
      <td className="px-4 py-3">
        <span className="block h-4 w-44 animate-pulse rounded bg-border-beige" />
      </td>
      <td className="px-4 py-3">
        <span className="block h-4 w-40 animate-pulse rounded bg-border-beige" />
      </td>
      <td className="px-4 py-3">
        <span className="block h-4 w-16 animate-pulse rounded bg-border-beige" />
      </td>
      <td className="px-4 py-3">
        <span className="block h-4 w-16 animate-pulse rounded bg-border-beige" />
      </td>
      <td className="px-4 py-3">
        <span className="block h-4 w-8 animate-pulse rounded bg-border-beige" />
      </td>
      <td className="px-4 py-3" />
    </tr>
  );
}

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
  activeFilters: ActiveFilters;
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isNavigating, startNavigation] = useTransition();
  const [isBulkBusy, startBulk] = useTransition();
  const { showToast } = useToast();

  const viewingArchived = activeFilters.status === 'archived';
  const pageIds = books.map((book) => book.id);
  const selectedCount = selectedIds.size;
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const someSelected = pageIds.some((id) => selectedIds.has(id)) && !allSelected;

  // A new page of results (or a refresh after an action) starts with nothing selected.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [books]);

  function navigate(next: URLSearchParams) {
    startNavigation(() => {
      router.push(`/admin/inventory?${next.toString()}`);
    });
  }

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    navigate(next);
  }

  function handleSort(column: InventorySortKey) {
    const next = new URLSearchParams(searchParams.toString());
    next.set('sort', column);
    next.set('dir', sort === column && dir === 'asc' ? 'desc' : 'asc');
    next.delete('page');
    navigate(next);
  }

  function handlePageChange(nextPage: number) {
    const next = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) next.delete('page');
    else next.set('page', String(nextPage));
    navigate(next);
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(pageIds));
  }

  function handleBulk(active: boolean) {
    const ids = [...selectedIds];
    const message = active
      ? `Restore ${ids.length} selected ${ids.length === 1 ? 'book' : 'books'}?`
      : `Delete ${ids.length} selected ${ids.length === 1 ? 'book' : 'books'}? They can be restored later from the Archived filter.`;
    if (!confirm(message)) return;

    startBulk(async () => {
      try {
        await bulkSetBooksActive(ids, active);
        setSelectedIds(new Set());
        showToast(active ? 'Books restored' : 'Books deleted');
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Something went wrong', 'error');
      }
    });
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

  const firstShown = totalCount === 0 ? 0 : (page - 1) * INVENTORY_PAGE_SIZE + 1;
  const lastShown = (page - 1) * INVENTORY_PAGE_SIZE + books.length;

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
          onBlur={(e) => {
            if (e.target.value !== (activeFilters.academic_year ?? '')) updateFilter('academic_year', e.target.value);
          }}
          className="rounded-md border border-brand-sage px-3 py-2 text-sm"
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const value = String(new FormData(e.currentTarget).get('q') ?? '').trim();
            updateFilter('q', value);
          }}
          className="flex items-center rounded-md border border-brand-sage bg-surface-card focus-within:border-brand-green"
        >
          <Search size={16} className="ml-3 shrink-0 text-ink-muted" aria-hidden="true" />
          <input
            name="q"
            type="search"
            defaultValue={activeFilters.q ?? ''}
            placeholder="Search title or author"
            aria-label="Search title or author"
            className="w-48 bg-transparent px-2 py-2 text-sm outline-none"
          />
        </form>

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
              <th className="w-10 px-4 py-3">
                <SelectCheckbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={toggleSelectAll}
                  label="Select all books on this page"
                  disabled={books.length === 0 || isNavigating}
                />
              </th>
              <th className="px-4 py-3">Cover</th>
              <SortHeader label="Title" column="title" sort={sort} dir={dir} onSort={handleSort} />
              <SortHeader label="Category / Level" column="category" sort={sort} dir={dir} onSort={handleSort} />
              <SortHeader label="Retail" column="retail" sort={sort} dir={dir} onSort={handleSort} />
              <SortHeader label="Wholesale" column="wholesale" sort={sort} dir={dir} onSort={handleSort} />
              <SortHeader label="Stock" column="stock" sort={sort} dir={dir} onSort={handleSort} />
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody aria-busy={isNavigating}>
            {isNavigating &&
              Array.from({ length: Math.min(books.length || 6, 8) }, (_, i) => <SkeletonRow key={`skeleton-${i}`} />)}

            {!isNavigating &&
              books.map((book) => (
                <tr
                  key={book.id}
                  className={`border-t border-border-beige ${selectedIds.has(book.id) ? 'bg-surface-cream/60' : ''}`}
                >
                  <td className="px-4 py-3">
                    <SelectCheckbox
                      checked={selectedIds.has(book.id)}
                      onChange={() => toggleSelect(book.id)}
                      label={`Select ${book.title}`}
                    />
                  </td>
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
                        book.stock_quantity <= book.low_stock_threshold
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

            {!isNavigating && books.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    compact
                    icon={<BookOpen size={22} />}
                    title="No books match these filters"
                    body="Try clearing a filter or the search, or add a new book."
                    actionHref="/admin/inventory"
                    actionLabel="Clear filters"
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalCount > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-muted tabular-nums">
            Showing {firstShown}–{lastShown} of {totalCount}
          </p>
          <Pagination page={page} pageCount={pageCount} onPageChange={handlePageChange} disabled={isNavigating} />
        </div>
      )}

      <BulkActionBar count={selectedCount} onClear={() => setSelectedIds(new Set())}>
        {viewingArchived ? (
          <button
            type="button"
            onClick={() => handleBulk(true)}
            disabled={isBulkBusy}
            className="rounded-xl bg-brand-green px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isBulkBusy ? 'Restoring…' : 'Restore selected'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleBulk(false)}
            disabled={isBulkBusy}
            className="rounded-xl bg-accent-terracotta px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isBulkBusy ? 'Deleting…' : 'Delete selected'}
          </button>
        )}
      </BulkActionBar>

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