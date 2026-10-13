// STRAYMUTANT.DEV — Tamak Bookshop
// Path: src/app/(storefront)/store/cart/actions.ts
'use server';

import { createClient } from '@/lib/supabase/server';

interface CheckoutItem {
  bookId: string;
  quantity: number;
}

export async function submitOrder(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let contactName = String(formData.get('contactName') ?? '').trim();
  let contactPhone = String(formData.get('contactPhone') ?? '').trim();

  // Signed-in customers order under the name on their account, not whatever was typed.
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name, phone')
      .eq('id', user.id)
      .single();

    if (profile?.role === 'vendor') {
      throw new Error('Wholesale accounts place orders from the wholesale cart (/vendor/cart)');
    }
    if (profile?.full_name) contactName = profile.full_name;
    if (!contactPhone && profile?.phone) contactPhone = profile.phone;
  }
  const paymentMethod = (['cash', 'mobile_money', 'bank_transfer'] as const).find(
    (m) => m === formData.get('paymentMethod'),
  );
  // The reference is given AFTER paying (it can't be known yet), so none is taken here.
  const paymentReference: string | null = null;
  const itemsRaw = String(formData.get('items') ?? '[]');

  if (!contactName || !contactPhone) throw new Error('Name and phone are required');
  if (!paymentMethod) {
    throw new Error('Choose a payment method');
  }

  // Pickup or delivery. Delivery needs an exact location; notes for the rider
  // are optional. The phone above is reused as the delivery contact number.
  const fulfillmentType = (['pickup', 'delivery'] as const).find(
    (f) => f === (formData.get('fulfillmentType') ?? 'pickup'),
  );
  if (!fulfillmentType) {
    throw new Error('Choose pickup or delivery');
  }
  let deliveryAddress: string | null = null;
  let deliveryNotes: string | null = null;
  if (fulfillmentType === 'delivery') {
    deliveryAddress = String(formData.get('deliveryAddress') ?? '').trim();
    if (!deliveryAddress) throw new Error('Enter the exact delivery location');
    deliveryNotes = String(formData.get('deliveryNotes') ?? '').trim() || null;
  }

  let requestedItems: CheckoutItem[];
  try {
    requestedItems = JSON.parse(itemsRaw);
  } catch {
    throw new Error('Cart data is invalid — please refresh and try again');
  }
  if (!requestedItems.length) throw new Error('Your cart is empty');

  // Re-fetch prices and stock from the DB rather than trusting the client.
  const bookIds = requestedItems.map((i) => i.bookId);
  const { data: books, error: booksError } = await supabase
    .from('books')
    .select('id, title, customer_price_pesewas, stock_quantity')
    .in('id', bookIds);

  if (booksError || !books) throw new Error(booksError?.message ?? 'Could not verify cart items');

  const orderItems = requestedItems.map((requested) => {
    const book = books.find((b) => b.id === requested.bookId);
    if (!book) throw new Error('One of the items in your cart is no longer available');
    if (book.stock_quantity < requested.quantity) {
      throw new Error(`Not enough stock for "${book.title}"`);
    }
    const unitPrice = book.customer_price_pesewas;
    return {
      book_id: book.id,
      quantity: requested.quantity,
      unit_price_pesewas: unitPrice,
      line_total_pesewas: unitPrice * requested.quantity,
    };
  });

  const subtotalPesewas = orderItems.reduce((sum, i) => sum + i.line_total_pesewas, 0);
  const totalPesewas = subtotalPesewas; // no separate delivery/tax modeled yet

  const orderNumber = `TB-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomUUID()
    .slice(0, 4)
    .toUpperCase()}`;

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      order_type: 'storefront_client',
      user_id: user?.id ?? null,
      contact_name: contactName,
      contact_phone: contactPhone,
      payment_method: paymentMethod,
      payment_reference: paymentReference,
      // Not "paid" until staff confirm the money arrived (see confirm_vendor_order_payment).
      payment_status: 'payment_pending',
      fulfillment_type: fulfillmentType,
      delivery_address: deliveryAddress,
      delivery_notes: deliveryNotes,
      subtotal_pesewas: subtotalPesewas,
      total_pesewas: totalPesewas,
    })
    .select('id, order_number')
    .single();

  if (orderError || !order) throw new Error(orderError?.message ?? 'Failed to create order');

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems.map((item) => ({ ...item, order_id: order.id })));

  if (itemsError) throw new Error(itemsError.message);

  // Stock is NOT deducted here: it comes out when staff confirm the payment.

  return { orderId: order.id, orderNumber: order.order_number, totalPesewas };
}