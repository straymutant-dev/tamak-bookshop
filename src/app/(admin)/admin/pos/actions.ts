// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { createClient } from '@/lib/supabase/server';
import { formatGHS } from '@/lib/currency';

interface SaleItem {
  bookId: string;
  title: string;
  quantity: number;
}

interface SyncPosSaleInput {
  clientUuid: string;
  orderNumber: string;
  soldAt: string;
  customerName: string | null;
  paymentMethod: 'cash' | 'mobile_money' | 'bank_transfer';
  paymentReference: string | null;
  items: { bookId: string; quantity: number; unitPricePesewas: number }[];
}

type SyncPosSaleResult =
  | { ok: true; orderId: string; warnings: string[] }
  | { ok: false; error: string; retryable: boolean };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORDER_NUMBER_PATTERN = /^TB-POS-[A-Z0-9]{6,16}-[A-Z0-9]{4}$/;
const PAYMENT_METHODS = ['cash', 'mobile_money', 'bank_transfer'] as const;

function validateSyncPosSaleInput(input: SyncPosSaleInput) {
  if (!UUID_PATTERN.test(input.clientUuid)) throw new Error('Sale id is invalid');
  if (!ORDER_NUMBER_PATTERN.test(input.orderNumber)) throw new Error('Order number is invalid');
  if (!input.soldAt || !Number.isFinite(Date.parse(input.soldAt))) throw new Error('Sale time is invalid');
  if (!PAYMENT_METHODS.includes(input.paymentMethod)) throw new Error('Choose a payment method');
  if (input.customerName !== null && typeof input.customerName !== 'string') {
    throw new Error('Customer name is invalid');
  }
  if (input.paymentReference !== null && typeof input.paymentReference !== 'string') {
    throw new Error('Payment reference is invalid');
  }
  if (!Array.isArray(input.items) || input.items.length === 0) throw new Error('The sale has no items');

  for (const item of input.items) {
    if (!UUID_PATTERN.test(item.bookId)) throw new Error('A book id in this sale is invalid');
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      throw new Error('A quantity in this sale is invalid');
    }
    if (!Number.isSafeInteger(item.unitPricePesewas) || item.unitPricePesewas < 0) {
      throw new Error('A price in this sale is invalid');
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRetryableRpcError(error: { code?: string; status?: number }) {
  if (error.code === 'P0001') return false;
  return (
    error.status === 408 ||
    error.status === 425 ||
    error.status === 429 ||
    (error.status !== undefined && error.status >= 500) ||
    error.code?.startsWith('08') === true
  );
}

function getSyncWarnings(data: unknown): { orderId: string; warnings: string[] } {
  if (
    !isRecord(data) ||
    typeof data.order_id !== 'string' ||
    !Array.isArray(data.shortfalls) ||
    !Array.isArray(data.price_changes)
  ) {
    throw new Error('The server returned an invalid sale sync response');
  }

  const warnings: string[] = [];
  for (const shortfall of data.shortfalls) {
    if (
      !isRecord(shortfall) ||
      typeof shortfall.title !== 'string' ||
      typeof shortfall.short !== 'number'
    ) {
      throw new Error('The server returned invalid stock warning data');
    }
    warnings.push(`${shortfall.title}: ${shortfall.short} fewer copies were in stock than sold.`);
  }
  for (const priceChange of data.price_changes) {
    if (
      !isRecord(priceChange) ||
      typeof priceChange.title !== 'string' ||
      typeof priceChange.quoted !== 'number' ||
      typeof priceChange.current !== 'number'
    ) {
      throw new Error('The server returned invalid price warning data');
    }
    warnings.push(
      `${priceChange.title}: sold at ${formatGHS(priceChange.quoted)}; current price is ${formatGHS(priceChange.current)}.`
    );
  }

  return { orderId: data.order_id, warnings };
}

export async function syncPosSale(input: SyncPosSaleInput): Promise<SyncPosSaleResult> {
  validateSyncPosSaleInput(input);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sign in to sync this sale', retryable: true };

  const { data, error } = await supabase.rpc('sync_pos_sale', {
    p_client_uuid: input.clientUuid,
    p_order_number: input.orderNumber,
    p_sold_at: input.soldAt,
    p_customer_name: input.customerName,
    p_method: input.paymentMethod,
    p_reference: input.paymentReference,
    p_items: input.items.map(({ bookId, quantity, unitPricePesewas }) => ({
      bookId,
      quantity,
      unitPricePesewas,
    })),
  });

  if (error) {
    return {
      ok: false,
      error: error.message,
      retryable: isRetryableRpcError(error),
    };
  }

  const sale = getSyncWarnings(data);
  return { ok: true, orderId: sale.orderId, warnings: sale.warnings };
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