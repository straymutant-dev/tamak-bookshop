// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { createClient } from '@/lib/supabase/server';

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