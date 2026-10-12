// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { ghsToPesewas } from '@/lib/currency';
import { CLASS_LEVELS, type ClassLevel } from '@/lib/types';
import type { Json } from '@/lib/database.types';

function isClassLevel(value: string): value is ClassLevel {
  return (CLASS_LEVELS as readonly string[]).includes(value);
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

const COVER_EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

async function uploadCoverIfProvided(bookId: string, file: File | null) {
  if (!file || file.size === 0) return undefined;

  const service = createServiceRoleClient();
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${bookId}/${Date.now()}.${ext}`;

  const { error } = await service.storage.from('book-covers').upload(path, file, {
    upsert: true,
    contentType: file.type,
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

  const { data: book, error } = await supabase
    .from('books')
    .insert({ ...fields, stock_quantity: stockQuantity })
    .select('id')
    .single();

  if (error || !book) throw new Error(error?.message ?? 'Failed to create book');

  const coverFile = formData.get('cover') as File | null;
  const coverUrl = await uploadCoverIfProvided(book.id, coverFile);

  if (coverUrl) {
    const { error: coverError } = await supabase
      .from('books')
      .update({ cover_image_url: coverUrl })
      .eq('id', book.id);
    if (coverError) throw new Error(`Book saved, but cover failed to attach: ${coverError.message}`);
  }

  revalidatePath('/admin/inventory');
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

  await logAudit('stock_writeoff', bookId, { quantity, reason });
  revalidatePath('/admin/inventory');
}