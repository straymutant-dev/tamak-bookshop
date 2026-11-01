// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { ghsToPesewas } from '@/lib/currency';
import { CLASS_LEVELS, type ClassLevel } from '@/lib/types';
import type { Json } from '@/lib/database.types';
import type { ChangeSet } from '@/lib/bookChanges';
import sharp from 'sharp';

function isClassLevel(value: string): value is ClassLevel {
  return (CLASS_LEVELS as readonly string[]).includes(value);
}

async function assertStaffOrAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin' && profile?.role !== 'staff') throw new Error('Staff or admin access required');
  return user.id;
}

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') throw new Error('Only admins can manage the book catalog');
  return user.id;
}

async function uploadCoverIfProvided(bookId: string, file: File | null) {
  if (!file || file.size === 0) return undefined;
  if (file.size > 4 * 1024 * 1024) throw new Error('Cover image must be 4 MB or smaller');
  if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
    throw new Error('Cover image must be a JPEG or PNG');
  }

  const input = Buffer.from(await file.arrayBuffer());
  const image = sharp(input, { limitInputPixels: 40_000_000 });
  const metadata = await image.metadata();
  if (metadata.format !== 'jpeg' && metadata.format !== 'png') {
    throw new Error('Cover image is not a valid JPEG or PNG');
  }

  const service = createServiceRoleClient();
  const path = `${bookId}/${Date.now()}.webp`;
  const optimized = await image
    .rotate()
    .resize({ width: 1600, height: 2400, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 92, effort: 5 })
    .toBuffer();

  const { error } = await service.storage.from('book-covers').upload(path, optimized, {
    upsert: true,
    contentType: 'image/webp',
  });

  if (error) throw new Error(`Cover upload failed: ${error.message}`);

  const { data } = service.storage.from('book-covers').getPublicUrl(path);
  return data.publicUrl;
}

function readBookFields(formData: FormData) {
  const rawClassLevel = String(formData.get('class_level') ?? '').trim();

  return {
    // title, author, category are NOT NULL in the books table (see
    // database.types.ts). Keep them as plain trimmed strings here — never
    // coerce to null — so a blank value fails the explicit check below with
    // a clear message instead of hitting Postgres as a raw constraint error.
    title: String(formData.get('title') ?? '').trim(),
    author: String(formData.get('author') ?? '').trim(),
    category: String(formData.get('category') ?? '').trim(),
    // subject is genuinely nullable in the DB — null is correct here.
    subject: String(formData.get('subject') ?? '').trim() || null,
    // class_level and academic_year are NOT NULL columns that carry a DB
    // default (see the Insert/Update types in database.types.ts: both are
    // optional but never `| null`). `null` is invalid for them — omitting
    // the key (`undefined`) is what lets the DB default apply on insert, or
    // leaves the existing value untouched on update. They were wrongly
    // coerced to `null` before; TS only caught it once the Supabase client
    // got its `<Database>` generic back, same cascade as the Tertiary bug.
    // class_level is further checked against the real enum — a stale or
    // tampered value falls back to "leave unset" rather than being sent raw.
    class_level: rawClassLevel && isClassLevel(rawClassLevel) ? rawClassLevel : undefined,
    academic_year: String(formData.get('academic_year') ?? '').trim() || undefined,
    buying_cost_pesewas: ghsToPesewas(Number(formData.get('buying_cost') ?? 0)),
    customer_price_pesewas: ghsToPesewas(Number(formData.get('customer_price') ?? 0)),
    vendor_price_pesewas: ghsToPesewas(Number(formData.get('vendor_price') ?? 0)),
  };
}

/**
 * Server-side backstop for the fields the DB requires (title, author,
 * category are NOT NULL columns). The form's `required` attributes catch
 * this first, but `required` is a client-side hint only — a direct action
 * call, a JS-disabled submit, or a stripped attribute all skip it. Without
 * this check, a blank value here used to fall through as `null` and either
 * violate the NOT NULL constraint with a raw Postgres error, or (for title,
 * which was never coerced to null) silently save an empty string.
 */
function assertRequiredBookFields(fields: { title: string; author: string; category: string }) {
  const missing: string[] = [];
  if (!fields.title) missing.push('Title');
  if (!fields.author) missing.push('Author');
  if (!fields.category) missing.push('Category');
  if (missing.length > 0) {
    throw new Error(`${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} required`);
  }
}

export async function createBook(formData: FormData) {
  await assertAdmin();
  const supabase = await createClient();
  const fields = readBookFields(formData);
  assertRequiredBookFields(fields);
  const stockQuantity = Number(formData.get('stock_quantity') ?? 0);

  // Upload the cover first, under an id made in advance, so the book is saved in ONE insert.
  // (Insert-then-attach-cover would record a second edit and mark a brand-new book as Updated.)
  const bookId = crypto.randomUUID();
  const coverUrl = await uploadCoverIfProvided(bookId, formData.get('cover') as File | null);

  const { error } = await supabase
    .from('books')
    .insert({ id: bookId, ...fields, stock_quantity: stockQuantity, ...(coverUrl ? { cover_image_url: coverUrl } : {}) });

  if (error) throw new Error(error.message);

  revalidatePath('/admin/inventory');
}

export interface InventoryImportRow {
  rowNumber: number;
  title: string;
  author: string;
  category: string;
  subject: string | null;
  class_level: ClassLevel | null;
  academic_year: string | null;
  buying_cost_pesewas: number;
  customer_price_pesewas: number;
  vendor_price_pesewas: number;
  stock_quantity: number;
  cover_filename: string | null;
}

export interface InventoryImportResult {
  rowNumber: number;
  title: string;
  status: 'created' | 'duplicate' | 'failed';
  bookId?: string;
  error?: string;
}

export async function importBooks(rows: InventoryImportRow[]): Promise<InventoryImportResult[]> {
  await assertAdmin();
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('No books to import');
  if (rows.length > 500) throw new Error('Import 500 books or fewer at a time');

  for (const row of rows) {
    if (!row.title?.trim() || !row.author?.trim() || !row.category?.trim()) {
      throw new Error(`Row ${row.rowNumber}: title, author, and category are required`);
    }
    if (row.class_level && !(CLASS_LEVELS as readonly string[]).includes(row.class_level)) {
      throw new Error(`Row ${row.rowNumber}: invalid class level`);
    }
    const prices = [row.buying_cost_pesewas, row.customer_price_pesewas, row.vendor_price_pesewas];
    if (!prices.every((value) => Number.isInteger(value) && value >= 0)) {
      throw new Error(`Row ${row.rowNumber}: prices must be zero or positive whole-pesewa amounts`);
    }
    if (!Number.isInteger(row.stock_quantity) || row.stock_quantity < 0) {
      throw new Error(`Row ${row.rowNumber}: stock quantity must be a whole number of zero or more`);
    }
  }

  const supabase = await createClient();
  const { data: existingBooks, error: existingError } = await supabase
    .from('books')
    .select('title, author')
    .eq('is_active', true);
  if (existingError) throw new Error(existingError.message);

  const existingKeys = new Set(
    (existingBooks ?? []).map((book) => `${book.title.trim().toLowerCase()}\n${(book.author ?? '').trim().toLowerCase()}`)
  );

  const results: InventoryImportResult[] = [];
  for (const row of rows) {
    const key = `${row.title.trim().toLowerCase()}\n${row.author.trim().toLowerCase()}`;
    if (existingKeys.has(key)) {
      results.push({ rowNumber: row.rowNumber, title: row.title, status: 'duplicate' });
      continue;
    }

    const id = crypto.randomUUID();
    const { error } = await supabase.from('books').insert({
      id,
      title: row.title,
      author: row.author,
      category: row.category,
      subject: row.subject,
      ...(row.class_level ? { class_level: row.class_level } : {}),
      ...(row.academic_year ? { academic_year: row.academic_year } : {}),
      buying_cost_pesewas: row.buying_cost_pesewas,
      customer_price_pesewas: row.customer_price_pesewas,
      vendor_price_pesewas: row.vendor_price_pesewas,
      stock_quantity: row.stock_quantity,
    });

    if (error) {
      results.push({ rowNumber: row.rowNumber, title: row.title, status: 'failed', error: error.message });
      continue;
    }

    existingKeys.add(key);
    results.push({ rowNumber: row.rowNumber, title: row.title, status: 'created', bookId: id });
  }

  revalidatePath('/admin/inventory');
  return results;
}

export async function uploadImportedBookCover(bookId: string, file: File, coverFilename: string) {
  await assertAdmin();
  if (!/^[0-9a-fA-F-]{36}$/.test(bookId)) throw new Error('Invalid book');

  const coverUrl = await uploadCoverIfProvided(bookId, file);
  if (!coverUrl) throw new Error('Invalid cover image');

  const supabase = await createClient();
  const { error } = await supabase.from('books').update({ cover_image_url: coverUrl }).eq('id', bookId);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/inventory');
  return { coverFilename, coverUrl };
}

export async function updateBook(bookId: string, formData: FormData) {
  await assertAdmin();
  const supabase = await createClient();
  const fields = readBookFields(formData);
  assertRequiredBookFields(fields);

  const coverFile = formData.get('cover') as File | null;
  const coverUrl = await uploadCoverIfProvided(bookId, coverFile);

  const { error } = await supabase
    .from('books')
    .update({ ...fields, ...(coverUrl ? { cover_image_url: coverUrl } : {}) })
    .eq('id', bookId);

  if (error) throw new Error(error.message);

  revalidatePath('/admin/inventory');
}

export async function deleteBook(bookId: string) {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from('books').update({ is_active: false }).eq('id', bookId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/inventory');
}

export async function restoreBook(bookId: string) {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from('books').update({ is_active: true }).eq('id', bookId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/inventory');
}

/** Archive or restore several books at once. The database trigger records each book's history. */
export async function bulkSetBooksActive(bookIds: string[], active: boolean) {
  await assertAdmin();

  const ids = Array.from(new Set(bookIds)).filter((id) => /^[0-9a-fA-F-]{36}$/.test(id));
  if (ids.length === 0) throw new Error('No books selected');
  if (ids.length > 200) throw new Error('Select 200 books or fewer at a time');

  const supabase = await createClient();
  const { error } = await supabase.from('books').update({ is_active: active }).in('id', ids);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/inventory');
}

// Catalogue edits are recorded by a database trigger (migration 42). Manual stock moves are not (every sale
// changes stock), so they are written to the book's history here.
async function logBookChange(
  bookId: string,
  action: 'stock_intake' | 'stock_writeoff' | 'stock_returned_to_publisher',
  changes: ChangeSet,
  note: string | null
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const changesJson = (Object.entries(changes) as [string, { before: Json; after: Json }][]).reduce<Record<string, Json | undefined>>(
    (result, [field, change]) => {
      result[field] = { before: change.before, after: change.after };
      return result;
    },
    {}
  );

  const { error } = await supabase.from('book_changes').insert({
    book_id: bookId,
    changed_by: user?.id ?? null,
    action,
    changes: changesJson,
    note,
  });
  if (error) console.error('book change log insert failed:', error.message);
}

async function logAudit(action: string, bookId: string, details: Record<string, Json>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from('audit_logs').insert({
    staff_id: user?.id ?? null,
    action,
    entity_type: 'books',
    entity_id: bookId,
    details_json: details,
  });

  if (error) console.error('audit log insert failed:', error.message);
}

export async function intakeStock(formData: FormData) {
  await assertAdmin();
  const bookId = String(formData.get('bookId') ?? '');
  const quantity = Number(formData.get('quantity') ?? 0);
  const note = String(formData.get('note') ?? '');

  if (!bookId || quantity <= 0) throw new Error('Provide a book and a positive quantity');

  const supabase = await createClient();
  const { data: book, error: fetchError } = await supabase
    .from('books')
    .select('stock_quantity')
    .eq('id', bookId)
    .single();

  if (fetchError || !book) throw new Error(fetchError?.message ?? 'Book not found');

  const { error } = await supabase
    .from('books')
    .update({ stock_quantity: book.stock_quantity + quantity })
    .eq('id', bookId);

  if (error) throw new Error(error.message);

  await logBookChange(
    bookId,
    'stock_intake',
    { stock_quantity: { before: book.stock_quantity, after: book.stock_quantity + quantity } },
    note.trim() || null
  );
  await logAudit('stock_intake', bookId, { quantity, note });
  revalidatePath('/admin/inventory');
}

export async function writeOffStock(formData: FormData) {
  await assertAdmin();
  const bookId = String(formData.get('bookId') ?? '');
  const quantity = Number(formData.get('quantity') ?? 0);
  const reason = String(formData.get('reason') ?? '').trim();

  if (!bookId || quantity <= 0) throw new Error('Provide a book and a positive quantity');
  if (!reason) throw new Error('A write-off reason is required');

  const supabase = await createClient();
  const { data: book, error: fetchError } = await supabase
    .from('books')
    .select('stock_quantity, damaged_quantity')
    .eq('id', bookId)
    .single();

  if (fetchError || !book) throw new Error(fetchError?.message ?? 'Book not found');
  if (book.stock_quantity < quantity) throw new Error('Cannot write off more than current stock');

  const { error } = await supabase
    .from('books')
    .update({
      stock_quantity: book.stock_quantity - quantity,
      damaged_quantity: book.damaged_quantity + quantity,
    })
    .eq('id', bookId);

  if (error) throw new Error(error.message);

  await logBookChange(
    bookId,
    'stock_writeoff',
    {
      stock_quantity: { before: book.stock_quantity, after: book.stock_quantity - quantity },
      damaged_quantity: { before: book.damaged_quantity, after: book.damaged_quantity + quantity },
    },
    reason
  );
  await logAudit('stock_writeoff', bookId, { quantity, reason });
  revalidatePath('/admin/inventory');
}

export async function returnStockToPublisher(formData: FormData) {
  await assertAdmin();
  const bookId = String(formData.get('bookId') ?? '');
  const quantity = Number(formData.get('quantity') ?? 0);
  const note = String(formData.get('note') ?? '').trim();

  if (!bookId || !Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Provide a book and a positive whole-number quantity');
  }

  const supabase = await createClient();
  const { data: book, error: fetchError } = await supabase
    .from('books')
    .select('stock_quantity')
    .eq('id', bookId)
    .single();

  if (fetchError || !book) throw new Error(fetchError?.message ?? 'Book not found');
  if (book.stock_quantity < quantity) throw new Error('Cannot return more than current stock');

  const { error } = await supabase
    .from('books')
    .update({ stock_quantity: book.stock_quantity - quantity })
    .eq('id', bookId);

  if (error) throw new Error(error.message);

  await logBookChange(
    bookId,
    'stock_returned_to_publisher',
    { stock_quantity: { before: book.stock_quantity, after: book.stock_quantity - quantity } },
    note || null
  );
  await logAudit('stock_returned_to_publisher', bookId, { quantity, note });
  revalidatePath('/admin/inventory');
}

export interface BookHistoryEntry {
  id: string;
  action: string;
  changedAt: string;
  editor: string | null;
  changes: ChangeSet;
  note: string | null;
}

function parseChangeSet(value: Json): ChangeSet {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Invalid book change history data');
  }

  const changes: ChangeSet = {};
  for (const [field, change] of Object.entries(value)) {
    if (
      typeof change !== 'object' ||
      change === null ||
      Array.isArray(change) ||
      !('before' in change) ||
      !('after' in change) ||
      change.before === undefined ||
      change.after === undefined
    ) {
      throw new Error('Invalid book change history data');
    }
    changes[field] = { before: change.before, after: change.after };
  }
  return changes;
}

/** The most recent changes to one book, newest first, with the name of whoever made each one. */
export async function getBookHistory(bookId: string): Promise<BookHistoryEntry[]> {
  await assertStaffOrAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('book_changes')
    .select('id, action, changed_at, changed_by, changes, note')
    .eq('book_id', bookId)
    .order('changed_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const editorIds = Array.from(new Set(rows.map((r) => r.changed_by).filter((id): id is string => !!id)));
  const names = new Map<string, string>();
  if (editorIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', editorIds);
    for (const p of profiles ?? []) names.set(p.id, p.full_name ?? 'Unknown');
  }

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    changedAt: r.changed_at,
    editor: r.changed_by ? (names.get(r.changed_by) ?? 'Unknown') : null,
    changes: parseChangeSet(r.changes),
    note: r.note,
  }));
}

/** An admin has looked at an edited book: clear its "Updated" marker. The trigger records this in the history. */
export async function markBookReviewed(bookId: string) {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from('books').update({ status: 'published' }).eq('id', bookId).eq('status', 'updated');
  if (error) throw new Error(error.message);
  revalidatePath('/admin/inventory');
}