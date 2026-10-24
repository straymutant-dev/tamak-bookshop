// STRAYMUTANT.DEV — Tamak Bookshop
// Shared by the edit form (before saving) and the History window (after): turns a set of
// field changes into readable "Before -> After" text.
import { formatGHS, ghsToPesewas } from '@/lib/currency';
import type { Json } from '@/lib/database.types';
import type { Book } from '@/lib/types';

export interface FieldChange {
  before: Json;
  after: Json;
}
export type ChangeSet = Record<string, FieldChange>;

export const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  author: 'Author',
  category: 'Category',
  subject: 'Subject',
  class_level: 'Class level',
  academic_year: 'Academic year',
  buying_cost_pesewas: 'Buying cost',
  customer_price_pesewas: 'Retail price',
  vendor_price_pesewas: 'Wholesale price',
  cover_image_url: 'Cover image',
  is_active: 'Listing',
  status: 'Review status',
  stock_quantity: 'Stock',
  damaged_quantity: 'Damaged / written off',
};

export const ACTION_LABELS: Record<string, string> = {
  created: 'Book added',
  edited: 'Book edited',
  archived: 'Book deleted (archived)',
  restored: 'Book restored',
  reviewed: 'Marked as reviewed',
  stock_intake: 'Stock received',
  stock_writeoff: 'Stock written off',
  stock_returned_to_publisher: 'Returned to publisher',
};

const STATUS_LABELS: Record<string, string> = {
  published: 'Published',
  updated: 'Updated',
  image_required: 'Image required',
  draft_import: 'Draft import',
};

function blank(value: unknown) {
  return value === null || value === undefined || value === '';
}

/** One field's change as text, e.g. { label: 'Retail price', before: 'GH₵ 20.00', after: 'GH₵ 22.00' }. */
export function describeChange(field: string, change: FieldChange) {
  const label = FIELD_LABELS[field] ?? field;

  if (field === 'cover_image_url') {
    return {
      label,
      before: blank(change.before) ? 'No cover' : 'Previous cover',
      after: blank(change.after) ? 'Removed' : 'New cover',
    };
  }

  const show = (value: unknown) => {
    if (blank(value)) return '—';
    if (field.endsWith('_pesewas')) return formatGHS(Number(value));
    if (field === 'is_active') return value ? 'Active' : 'Archived';
    if (field === 'status') return STATUS_LABELS[String(value)] ?? String(value);
    return String(value);
  };
  return { label, before: show(change.before), after: show(change.after) };
}

/**
 * What an edit would change, worked out in the browser BEFORE saving, using the same rules the
 * server applies when it saves (blank class level / academic year = "leave as it is").
 */
export function diffBookForm(book: Book, formData: FormData): ChangeSet {
  const changes: ChangeSet = {};
  const text = (name: string) => String(formData.get(name) ?? '').trim();
  const set = (field: string, before: Json, after: Json) => {
    if ((before ?? null) !== (after ?? null)) changes[field] = { before: before ?? null, after: after ?? null };
  };

  set('title', book.title, text('title'));
  set('author', book.author ?? '', text('author'));
  set('category', book.category ?? '', text('category'));
  set('subject', book.subject ?? null, text('subject') || null);
  if (text('class_level')) set('class_level', book.class_level, text('class_level'));
  if (text('academic_year')) set('academic_year', book.academic_year, text('academic_year'));
  set('buying_cost_pesewas', book.buying_cost_pesewas, ghsToPesewas(Number(formData.get('buying_cost') ?? 0)));
  set('customer_price_pesewas', book.customer_price_pesewas, ghsToPesewas(Number(formData.get('customer_price') ?? 0)));
  set('vendor_price_pesewas', book.vendor_price_pesewas, ghsToPesewas(Number(formData.get('vendor_price') ?? 0)));

  const cover = formData.get('cover');
  if (cover instanceof File && cover.size > 0) set('cover_image_url', book.cover_image_url, 'new-upload');

  return changes;
}