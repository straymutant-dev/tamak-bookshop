// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState, useTransition } from 'react';
import type { Book, ClassLevel } from '@/lib/types';
import { pesewasToGHS } from '@/lib/currency';
import { createBook, updateBook } from './actions';
import { describeChange, diffBookForm, type ChangeSet } from '@/lib/bookChanges';
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
  // Editing: the form first shows what will change (before -> after); nothing is saved until you confirm.
  const [review, setReview] = useState<{ formData: FormData; changes: ChangeSet } | null>(null);

  const { showToast } = useToast();

  function save(formData: FormData) {
    startTransition(async () => {
      try {
        if (book) await updateBook(book.id, formData);
        else await createBook(formData);
        showToast(book ? 'Book updated successfully' : 'Book added successfully');
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
        setReview(null);
      }
    });
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    if (!book) {
      save(formData);
      return;
    }
    const changes = diffBookForm(book, formData);
    if (Object.keys(changes).length === 0) {
      setError('Nothing was changed.');
      return;
    }
    setReview({ formData, changes });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-surface-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-ink">
          {review ? 'Review changes' : book ? 'Edit book' : 'Add book'}
        </h2>

        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {/* Kept mounted (just hidden) while reviewing, so "Back" brings the form back exactly as it was. */}
        <form action={handleSubmit} className={review ? 'hidden' : 'flex flex-col gap-3'}>
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
                className="inventory-select w-full"
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
            Cover image
            <input
              name="cover"
              type="file"
              accept="image/png,image/jpeg"
              className="rounded-md border border-brand-sage px-3 py-2"
            />
            <span className="text-xs text-ink-muted">
              PNG or JPEG, up to 4 MB. Covers are automatically resized and optimized for the catalog.
            </span>
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

        {review && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink-muted">
              Check what will change. Every change is saved in this book&rsquo;s history with your name and the time.
            </p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-ink-muted">
                <tr>
                  <th className="pb-2 pr-3 font-medium">Field</th>
                  <th className="pb-2 pr-3 font-medium">Before</th>
                  <th className="pb-2 font-medium">After</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(review.changes).map(([field, change]) => {
                  const d = describeChange(field, change);
                  return (
                    <tr key={field} className="border-t border-border-beige align-top">
                      <td className="py-2 pr-3 text-ink-muted">{d.label}</td>
                      <td className="py-2 pr-3 text-ink-muted line-through">{d.before}</td>
                      <td className="py-2 font-medium text-ink">{d.after}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-xs text-ink-muted">
              After saving, this book shows <span className="font-medium text-ink">Updated</span> in the list until an
              admin marks it as reviewed.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setReview(null)}
                className="rounded-md border border-brand-sage px-4 py-2 text-sm text-ink"
              >
                Back
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => save(review.formData)}
                className="rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {isPending ? 'Saving…' : 'Confirm and save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}