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

  const subtotalPesewas = orderItems.reduce((sum, i) => sum + i.line_total_pesewas, 0);

  // Credit orders still waiting for approval are a promise to buy on credit, so
  // they count against the limit too. Otherwise a vendor could queue several
  // orders that together go past their limit.
  const { data: pendingOrders, error: pendingError } = await supabase
    .from('orders')
    .select('total_pesewas')
    .eq('user_id', user.id)
    .eq('payment_status', 'credit_pending');

  if (pendingError) throw new Error(pendingError.message);

  const pendingPesewas = (pendingOrders ?? []).reduce((sum, o) => sum + o.total_pesewas, 0);
  const availableCredit = Math.max(
    0,
    profile.credit_limit_pesewas - profile.outstanding_balance_pesewas - pendingPesewas
  );

  if (subtotalPesewas > availableCredit) {
    throw new Error(
      `This order (${(subtotalPesewas / 100).toFixed(2)} GHS) exceeds your available credit (${(availableCredit / 100).toFixed(2)} GHS)` +
        (pendingPesewas > 0 ? `, after ${(pendingPesewas / 100).toFixed(2)} GHS of orders still awaiting approval` : '')
    );
  }

  const orderNumber = `TB-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      order_type: 'storefront_vendor',
      user_id: user.id,
      contact_name: profile.full_name,
      contact_phone: phone,
      fulfillment_type: fulfillment.type,
      delivery_address: fulfillment.address,
      delivery_notes: fulfillment.notes,
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

  if (!profile.phone) await supabase.from('profiles').update({ phone }).eq('id', user.id);

  // Stock is NOT deducted and the vendor's balance is NOT increased here —
  // this order sits as credit_pending until staff/admin approves it via
  // /admin/approvals.

  // "We received your order" email to the account's receipt email (never blocks the order).
  after(() => sendOrderEmail(order.id, 'placed'));

  return { orderId: order.id, orderNumber: order.order_number, totalPesewas: subtotalPesewas };
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

  const subtotalPesewas = orderItems.reduce((sum, i) => sum + i.line_total_pesewas, 0);
  const orderNumber = `TB-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      order_type: 'storefront_vendor',
      user_id: user.id,
      contact_name: profile.full_name,
      contact_phone: phone,
      fulfillment_type: fulfillment.type,
      delivery_address: fulfillment.address,
      delivery_notes: fulfillment.notes,
      payment_method: paymentMethod,
      payment_reference: paymentReference,
      // Not "paid" until staff confirm the money arrived (see confirm_vendor_order_payment).
      payment_status: 'payment_pending',
      cheque_number: paymentMethod === 'cheque' ? paymentReference : null,
      cheque_cleared: paymentMethod === 'cheque' ? false : null,
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

  if (!profile.phone) await supabase.from('profiles').update({ phone }).eq('id', user.id);

  // Stock is NOT deducted here. It comes out when staff confirm the payment.

  // "We received your order" email to the account's receipt email (never blocks the order).
  after(() => sendOrderEmail(order.id, 'placed'));

  return { orderId: order.id, orderNumber: order.order_number, totalPesewas: subtotalPesewas };
}

// The two functions people call. They return { ok: true, ... } or { ok: false, error } so the page can show
// the real message in production (see lib/actionResult.ts).
export async function submitVendorOrder(formData: FormData) {
  return runAction(() => placeVendorOrder(formData));
}

export async function submitVendorOrderImmediatePayment(formData: FormData) {
  return runAction(() => placeVendorOrderImmediatePayment(formData));
}