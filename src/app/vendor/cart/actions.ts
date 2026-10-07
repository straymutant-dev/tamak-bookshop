// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { createClient } from '@/lib/supabase/server';

interface CheckoutItem {
  bookId: string;
  quantity: number;
}

export async function submitVendorOrder(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, vendor_status, credit_limit_pesewas, outstanding_balance_pesewas, business_name, full_name')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'vendor') throw new Error('Only vendor accounts can place wholesale credit orders');
  if (profile.vendor_status !== 'approved') {
    throw new Error('Your wholesale account is not yet approved for credit orders');
  }

  const itemsRaw = String(formData.get('items') ?? '[]');
  let requestedItems: CheckoutItem[];
  try {
    requestedItems = JSON.parse(itemsRaw);
  } catch {
    throw new Error('Cart data is invalid — please refresh and try again');
  }
  if (!requestedItems.length) throw new Error('Your cart is empty');

  const bookIds = requestedItems.map((i) => i.bookId);
  const { data: books, error: booksError } = await supabase
    .from('books')
    .select('id, title, vendor_price_pesewas, customer_price_pesewas, stock_quantity')
    .in('id', bookIds);

  if (booksError || !books) throw new Error(booksError?.message ?? 'Could not verify cart items');

  const orderItems = requestedItems.map((requested) => {
    const book = books.find((b) => b.id === requested.bookId);
    if (!book) throw new Error('One of the items in your cart is no longer available');
    if (book.stock_quantity < requested.quantity) {
      throw new Error(`Not enough stock for "${book.title}"`);
    }
    const unitPrice = book.vendor_price_pesewas || book.customer_price_pesewas;
    return {
      book_id: book.id,
      quantity: requested.quantity,
      unit_price_pesewas: unitPrice,
      line_total_pesewas: unitPrice * requested.quantity,
    };
  });

  const subtotalPesewas = orderItems.reduce((sum, i) => sum + i.line_total_pesewas, 0);
  const availableCredit = profile.credit_limit_pesewas - profile.outstanding_balance_pesewas;

  if (subtotalPesewas > availableCredit) {
    throw new Error(
      `This order (${(subtotalPesewas / 100).toFixed(2)} GHS) exceeds your available credit (${(availableCredit / 100).toFixed(2)} GHS)`
    );
  }

  const orderNumber = `TB-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      order_type: 'storefront_vendor',
      user_id: user.id,
      contact_name: profile.business_name || profile.full_name,
      payment_method: 'credit',
      payment_status: 'credit_pending',
      subtotal_pesewas: subtotalPesewas,
      total_pesewas: subtotalPesewas,
    })
    .select('id, order_number')
    .single();

  if (orderError || !order) throw new Error(orderError?.message ?? 'Failed to create order');

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems.map((item) => ({ ...item, order_id: order.id })));

  if (itemsError) throw new Error(itemsError.message);

  // Stock is NOT deducted and the vendor's balance is NOT increased here —
  // this order sits as credit_pending until staff/admin approves it via
  // /admin/approvals.

  return { orderNumber: order.order_number };
}

export async function submitVendorOrderImmediatePayment(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, vendor_status, business_name, full_name')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'vendor') throw new Error('Only vendor accounts can order here');
  if (profile.vendor_status !== 'approved') {
    throw new Error('Your wholesale account is not yet approved');
  }

  const paymentMethod = String(formData.get('paymentMethod') ?? '');
  if (!['cash', 'mobile_money', 'bank_transfer'].includes(paymentMethod)) {
    throw new Error('Choose a payment method');
  }
  const paymentReference = String(formData.get('paymentReference') ?? '').trim() || null;

  const itemsRaw = String(formData.get('items') ?? '[]');
  let requestedItems: { bookId: string; quantity: number }[];
  try {
    requestedItems = JSON.parse(itemsRaw);
  } catch {
    throw new Error('Cart data is invalid — please refresh and try again');
  }
  if (!requestedItems.length) throw new Error('Your cart is empty');

  const bookIds = requestedItems.map((i) => i.bookId);
  const { data: books, error: booksError } = await supabase
    .from('books')
    .select('id, title, vendor_price_pesewas, customer_price_pesewas, stock_quantity')
    .in('id', bookIds);

  if (booksError || !books) throw new Error(booksError?.message ?? 'Could not verify cart items');

  const orderItems = requestedItems.map((requested) => {
    const book = books.find((b) => b.id === requested.bookId);
    if (!book) throw new Error('One of the items in your cart is no longer available');
    if (book.stock_quantity < requested.quantity) throw new Error(`Not enough stock for "${book.title}"`);
    const unitPrice = book.vendor_price_pesewas || book.customer_price_pesewas;
    return {
      book_id: book.id,
      title: book.title,
      quantity: requested.quantity,
      unit_price_pesewas: unitPrice,
      line_total_pesewas: unitPrice * requested.quantity,
    };
  });

  const subtotalPesewas = orderItems.reduce((sum, i) => sum + i.line_total_pesewas, 0);
  const orderNumber = `TB-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      order_type: 'storefront_vendor',
      user_id: user.id,
      contact_name: profile.business_name || profile.full_name,
      payment_method: paymentMethod,
      payment_reference: paymentReference,
      subtotal_pesewas: subtotalPesewas,
      total_pesewas: subtotalPesewas,
    })
    .select('id, order_number')
    .single();

  if (orderError || !order) throw new Error(orderError?.message ?? 'Failed to create order');

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems.map(({ title, ...item }) => ({ ...item, order_id: order.id })));
  if (itemsError) throw new Error(itemsError.message);

  for (const item of orderItems) {
    const { error: stockError } = await supabase.rpc('decrement_book_stock', {
      book_id: item.book_id,
      qty: item.quantity,
    });
    if (stockError) throw new Error(`Stock update failed for "${item.title}": ${stockError.message}`);
  }

  return { orderNumber: order.order_number };
}