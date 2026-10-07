// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { ghsToPesewas } from '@/lib/currency';

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
  return {
    title: String(formData.get('title') ?? '').trim(),
    author: String(formData.get('author') ?? '').trim() || null,
    category: String(formData.get('category') ?? '').trim() || null,
    subject: String(formData.get('subject') ?? '').trim() || null,
    class_level: String(formData.get('class_level') ?? '').trim() || null,
    academic_year: String(formData.get('academic_year') ?? '').trim() || null,
    buying_cost_pesewas: ghsToPesewas(Number(formData.get('buying_cost') ?? 0)),
    customer_price_pesewas: ghsToPesewas(Number(formData.get('customer_price') ?? 0)),
    vendor_price_pesewas: ghsToPesewas(Number(formData.get('vendor_price') ?? 0)),
  };
}

export async function createBook(formData: FormData) {
  await assertAdmin();
  const supabase = await createClient();
  const fields = readBookFields(formData);
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

async function logAudit(action: string, bookId: string, details: Record<string, unknown>) {
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