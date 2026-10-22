// STRAYMUTANT.DEV — Tamak Bookshop
// Path: src/app/(admin)/admin/pos/actions.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { formatGHS } from '@/lib/currency';
import type { Json } from '@/lib/database.types';

interface SaleItem {
  bookId: string;
  title: string;
  quantity: number;
}

export async function submitPosSale(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const customerName = String(formData.get('customerName') ?? '').trim() || null;
  const paymentMethod = (['cash', 'mobile_money', 'bank_transfer'] as const).find(
    (m) => m === formData.get('paymentMethod'),
  );
  const paymentReference = String(formData.get('paymentReference') ?? '').trim() || null;
  const itemsRaw = String(formData.get('items') ?? '[]');

  if (!paymentMethod) {
    throw new Error('Choose a payment method');
  }

  let requestedItems: SaleItem[];
  try {
    requestedItems = JSON.parse(itemsRaw);
  } catch {
    throw new Error('Cart data is invalid — please refresh and try again');
  }
  if (!requestedItems.length) throw new Error('Cart is empty');

  const bookIds = requestedItems.map((i) => i.bookId);
  const { data: books, error: booksError } = await supabase
    .from('books')
    .select('id, title, customer_price_pesewas, stock_quantity')
    .in('id', bookIds);

  if (booksError || !books) throw new Error(booksError?.message ?? 'Could not verify cart items');

  const orderItems = requestedItems.map((requested) => {
    const book = books.find((b) => b.id === requested.bookId);
    if (!book) throw new Error('One of the items is no longer available');
    if (book.stock_quantity < requested.quantity) {
      throw new Error(`Not enough stock for "${book.title}"`);
    }
    const unitPrice = book.customer_price_pesewas;
    return {
      book_id: book.id,
      title: book.title,
      quantity: requested.quantity,
      unit_price_pesewas: unitPrice,
      line_total_pesewas: unitPrice * requested.quantity,
    };
  });

  const subtotalPesewas = orderItems.reduce((sum, i) => sum + i.line_total_pesewas, 0);

  const orderNumber = `TB-POS-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomUUID()
    .slice(0, 4)
    .toUpperCase()}`;

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      order_type: 'counter_pos',
      staff_id: user.id,
      user_id: null,
      contact_name: customerName,
      payment_method: paymentMethod,
      payment_reference: paymentReference,
      subtotal_pesewas: subtotalPesewas,
      total_pesewas: subtotalPesewas,
    })
    .select('id, order_number, created_at')
    .single();

  if (orderError || !order) throw new Error(orderError?.message ?? 'Failed to create order');

  const { error: itemsError } = await supabase.from('order_items').insert(
    orderItems.map(({ title, ...item }) => ({ ...item, order_id: order.id }))
  );
  if (itemsError) throw new Error(itemsError.message);

  for (const item of orderItems) {
    const { error: stockError } = await supabase.rpc('decrement_book_stock', {
      book_id: item.book_id,
      qty: item.quantity,
    });
    if (stockError) throw new Error(`Stock update failed for "${item.title}": ${stockError.message}`);
  }

  const { error: auditError } = await supabase.from('audit_logs').insert({
    staff_id: user.id,
    action: 'pos_sale_created',
    entity_type: 'orders',
    entity_id: order.id,
    details_json: { orderNumber: order.order_number, totalPesewas: subtotalPesewas, itemCount: orderItems.length },
  });
  if (auditError) console.error('audit log insert failed:', auditError.message);

  return {
    
    orderId: order.id,
    orderNumber: order.order_number,
    createdAt: order.created_at,
    items: orderItems,
    subtotalPesewas,
    totalPesewas: subtotalPesewas,
    paymentMethod,
    paymentReference,
    customerName,
  };
}

// ---------------------------------------------------------------------------
// Offline POS: record a sale that was saved on the till first.
// Returns a result object (instead of throwing) because Next hides the text of thrown errors in
// production, and the till needs to tell "try again later" apart from "the server refused this".
// ---------------------------------------------------------------------------

export interface SyncSaleInput {
  clientUuid: string;
  orderNumber: string;
  soldAt: string;
  customerName: string | null;
  paymentMethod: string;
  paymentReference: string | null;
  items: { bookId: string; quantity: number; unitPricePesewas: number }[];
}

export type SyncSaleResult =
  | { ok: true; orderId: string; orderNumber: string; alreadySynced: boolean; warnings: string[] }
  | { ok: false; error: string; retryable: boolean };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function syncPosSale(input: SyncSaleInput): Promise<SyncSaleResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Please sign in again so your saved sales can be sent.', retryable: true };
  }

  const method = (['cash', 'mobile_money', 'bank_transfer'] as const).find((m) => m === input.paymentMethod);
  const itemsOk =
    Array.isArray(input.items) &&
    input.items.length > 0 &&
    input.items.every(
      (i) =>
        UUID_RE.test(i.bookId) &&
        Number.isInteger(i.quantity) &&
        i.quantity > 0 &&
        Number.isInteger(i.unitPricePesewas) &&
        i.unitPricePesewas >= 0
    );
  if (!UUID_RE.test(input.clientUuid) || !method || !itemsOk) {
    return { ok: false, error: 'This saved sale is not valid.', retryable: false };
  }

  const { data, error } = await supabase.rpc('sync_pos_sale', {
    p_client_uuid: input.clientUuid,
    p_order_number: input.orderNumber,
    p_sold_at: input.soldAt,
    p_customer_name: input.customerName ?? '',
    p_method: method,
    p_reference: input.paymentReference ?? '',
    p_items: input.items as unknown as Json,
  });

  if (error || !data) {
    const message = error?.message ?? 'The sale could not be saved';
    const retryable = /fetch failed|network|timeout|timed out|econn|enotfound|not authenticated/i.test(message);
    return { ok: false, error: message, retryable };
  }

  const r = data as {
    order_id: string;
    order_number: string;
    already_synced: boolean;
    shortfalls: { title: string; sold: number; inStock: number }[];
    price_changes: { title: string; quoted: number; current: number }[];
  };

  const warnings: string[] = [
    ...(r.price_changes ?? []).map(
      (p) => `${p.title}: sold at ${formatGHS(p.quoted)}, the price is now ${formatGHS(p.current)}.`
    ),
    ...(r.shortfalls ?? []).map(
      (s) => `${s.title}: only ${s.inStock} of ${s.sold} were in stock when this sale reached the shop system. Check the stock count.`
    ),
  ];

  return { ok: true, orderId: r.order_id, orderNumber: r.order_number, alreadySynced: r.already_synced, warnings };
}