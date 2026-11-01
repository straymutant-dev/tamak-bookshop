// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { createClient } from '@/lib/supabase/server';
import { normalizeGhanaPhone } from '@/lib/phone';
import { after } from 'next/server';
import { sendOrderEmail } from '@/lib/orderEmail';
import { runAction } from '@/lib/actionResult';

// Pickup or delivery from the checkout form. Delivery needs an exact location;
// notes for the rider are optional. Pickup stores no address.
function readFulfillment(formData: FormData): {
  type: 'pickup' | 'delivery';
  address: string | null;
  notes: string | null;
} {
  const type = String(formData.get('fulfillmentType') ?? 'pickup');
  if (type !== 'pickup' && type !== 'delivery') throw new Error('Choose pickup or delivery');
  if (type === 'pickup') return { type, address: null, notes: null };

  const address = String(formData.get('deliveryAddress') ?? '').trim();
  if (address.length < 5) throw new Error('Enter the exact delivery location');
  const notes = String(formData.get('deliveryNotes') ?? '').trim() || null;
  return { type, address, notes };
}

interface CheckoutItem {
  bookId: string;
  quantity: number;
}

async function placeVendorOrder(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, vendor_status, credit_limit_pesewas, outstanding_balance_pesewas, business_name, full_name, phone')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'vendor') throw new Error('Only vendor accounts can place wholesale credit orders');
  if (profile.vendor_status !== 'approved') {
    throw new Error('Your wholesale account is not yet approved for credit orders');
  }

  const phone = normalizeGhanaPhone(String(formData.get('contactPhone') ?? ''));
  if (!phone) throw new Error('Enter a valid phone number we can reach you on, e.g. 024 123 4567');

  const fulfillment = readFulfillment(formData);

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

  const operationId = String(formData.get('operationId') ?? crypto.randomUUID());
  const { data: result, error } = await supabase.rpc('place_vendor_credit_order', {
    p_client_operation_id: operationId,
    p_phone: phone,
    p_fulfillment: fulfillment.type,
    p_delivery_address: fulfillment.address,
    p_delivery_notes: fulfillment.notes,
    p_items: requestedItems.map((item) => ({ bookId: item.bookId, quantity: item.quantity })),
  });
  if (error || !result) throw new Error(error?.message ?? 'Failed to create order');
  const order = result as unknown as { order_id: string; order_number: string; total_pesewas: number };

  after(() => sendOrderEmail(order.order_id, 'placed'));

  return { orderId: order.order_id, orderNumber: order.order_number, totalPesewas: order.total_pesewas };
}

async function placeVendorOrderImmediatePayment(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, vendor_status, business_name, full_name, phone')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'vendor') throw new Error('Only vendor accounts can order here');
  if (profile.vendor_status !== 'approved') {
    throw new Error('Your wholesale account is not yet approved');
  }

  const paymentMethod = (['cash', 'mobile_money', 'bank_transfer', 'cheque'] as const).find(
    (m) => m === formData.get('paymentMethod'),
  );
  if (!paymentMethod) {
    throw new Error('Choose a payment method');
  }
  const paymentReference = String(formData.get('paymentReference') ?? '').trim() || null;

  const phone = normalizeGhanaPhone(String(formData.get('contactPhone') ?? ''));
  if (!phone) throw new Error('Enter a valid phone number we can reach you on, e.g. 024 123 4567');

  const fulfillment = readFulfillment(formData);

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
      quantity: requested.quantity,
      unit_price_pesewas: unitPrice,
      line_total_pesewas: unitPrice * requested.quantity,
    };
  });

  const operationId = String(formData.get('operationId') ?? crypto.randomUUID());
  const { data: result, error } = await supabase.rpc('place_vendor_immediate_order', {
    p_client_operation_id: operationId,
    p_phone: phone,
    p_method: paymentMethod,
    p_reference: paymentReference,
    p_fulfillment: fulfillment.type,
    p_delivery_address: fulfillment.address,
    p_delivery_notes: fulfillment.notes,
    p_items: requestedItems.map((item) => ({ bookId: item.bookId, quantity: item.quantity })),
  });
  if (error || !result) throw new Error(error?.message ?? 'Failed to create order');
  const order = result as unknown as { order_id: string; order_number: string; total_pesewas: number };

  after(() => sendOrderEmail(order.order_id, 'placed'));

  return { orderId: order.order_id, orderNumber: order.order_number, totalPesewas: order.total_pesewas };
}

// The two functions people call. They return { ok: true, ... } or { ok: false, error } so the page can show
// the real message in production (see lib/actionResult.ts).
export async function submitVendorOrder(formData: FormData) {
  return runAction(() => placeVendorOrder(formData));
}

export async function submitVendorOrderImmediatePayment(formData: FormData) {
  return runAction(() => placeVendorOrderImmediatePayment(formData));
}