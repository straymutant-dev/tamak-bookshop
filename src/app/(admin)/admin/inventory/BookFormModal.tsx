// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState, useTransition } from 'react';
import type { Book, ClassLevel } from '@/lib/types';
import { pesewasToGHS } from '@/lib/currency';
import { createBook, updateBook } from './actions';
import { useToast } from '@/components/ui/ToastContext';

export default function BookFormModal({
  book,
  classLevels,
  onClose,
}: {
  book: Book | null;
  classLevels: ClassLevel[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const { showToast } = useToast();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        if (book) await updateBook(book.id, formData);
        else await createBook(formData);
        showToast(book ? 'Book updated successfully' : 'Book added successfully');
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-surface-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-ink">
          {book ? 'Edit book' : 'Add book'}
        </h2>

        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <form action={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Title
            <input
              name="title"
              defaultValue={book?.title}
              required
              className="rounded-md border border-brand-sage px-3 py-2"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Author
              <input
                name="author"
                defaultValue={book?.author ?? ''}
                required
                className="rounded-md border border-brand-sage px-3 py-2"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Category (type)
              <input
                name="category"
                defaultValue={book?.category ?? ''}
                placeholder="Textbook, Workbook, Past Questions…"
                required
                className="rounded-md border border-brand-sage px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Subject
              <input
                name="subject"
                defaultValue={book?.subject ?? ''}
                placeholder="Mathematics, English, Science…"
                className="rounded-md border border-brand-sage px-3 py-2"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Class level
              <select
                name="class_level"
                defaultValue={book?.class_level ?? ''}
                className="rounded-md border border-brand-sage px-3 py-2"
              >
                <option value="">—</option>
                {classLevels.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Academic year
              <input
                name="academic_year"
                defaultValue={book?.academic_year ?? ''}
                placeholder="2026/2027"
                className="rounded-md border border-brand-sage px-3 py-2"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Buying cost (GHS)
              <input
                name="buying_cost"
                type="number"
                step="0.01"
                min="0"
                defaultValue={book ? pesewasToGHS(book.buying_cost_pesewas) : ''}
                required
                className="rounded-md border border-brand-sage px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Retail price (GHS)
              <input
                name="customer_price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={book ? pesewasToGHS(book.customer_price_pesewas) : ''}
                required
                className="rounded-md border border-brand-sage px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Wholesale price (GHS)
              <input
                name="vendor_price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={book ? pesewasToGHS(book.vendor_price_pesewas) : ''}
                required
                className="rounded-md border border-brand-sage px-3 py-2"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            Opening stock quantity
            <input
              name="stock_quantity"
              type="number"
              min="0"
              defaultValue={book?.stock_quantity ?? 0}
              disabled={!!book}
              className="rounded-md border border-brand-sage px-3 py-2 disabled:bg-surface-cream disabled:text-ink-muted"
            />
          </label>
          {book && (
            <p className="text-xs text-ink-muted">
              Use “Adjust stock” from the table to change quantity after creation.
            </p>
          )}

          <label className="flex flex-col gap-1 text-sm">
            Low-stock alert at
            <input
              name="low_stock_threshold"
              type="number"
              min="0"
              step="1"
              defaultValue={book?.low_stock_threshold ?? 5}
              className="rounded-md border border-brand-sage px-3 py-2"
            />
            <span className="text-xs text-ink-muted">
              Flag this book when stock falls to this number or below.
            </span>
          </label>         

          <label className="flex flex-col gap-1 text-sm">
            Cover image
            <input
              name="cover"
              type="file"
              accept="image/png,image/jpeg"
              className="rounded-md border border-brand-sage px-3 py-2"
            />
            <span className="text-xs text-ink-muted">PNG or JPEG only.</span>
          </label>

          <div className="mt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-brand-sage px-4 py-2 text-sm text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isPending ? 'Saving…' : book ? 'Save changes' : 'Add book'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}