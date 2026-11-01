// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { createClient } from '@/lib/supabase/server';
import { parseEmail } from '@/lib/email';
import { runAction } from '@/lib/actionResult';
import { after } from 'next/server';
import { sendOrderEmail } from '@/lib/orderEmail';

interface CheckoutItem {
  bookId: string;
  quantity: number;
}

async function placeOrder(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let contactName = String(formData.get('contactName') ?? '').trim();
  let contactPhone = String(formData.get('contactPhone') ?? '').trim();
  // Optional: where the receipt is emailed. Throws a friendly error if it is not an email address.
  let contactEmail = parseEmail(formData.get('contactEmail'));

  // Signed-in customers order under the name on their account, not whatever was typed.
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name, phone, contact_email')
      .eq('id', user.id)
      .single();

    if (profile?.role === 'vendor') {
      throw new Error('Wholesale accounts place orders from the wholesale cart (/vendor/cart)');
    }
    if (profile?.full_name) contactName = profile.full_name;
    if (!contactPhone && profile?.phone) contactPhone = profile.phone;
    if (!contactEmail) contactEmail = profile?.contact_email || user.email || null;
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

  const operationId = String(formData.get('operationId') ?? crypto.randomUUID());
  const { data: result, error: orderError } = await supabase.rpc('place_storefront_order', {
    p_client_operation_id: operationId,
    p_contact_name: contactName,
    p_contact_phone: contactPhone,
    p_contact_email: contactEmail,
    p_method: paymentMethod,
    p_fulfillment: fulfillmentType,
    p_delivery_address: deliveryAddress,
    p_delivery_notes: deliveryNotes,
    p_items: requestedItems.map((item) => ({ bookId: item.bookId, quantity: item.quantity })),
  });

  if (orderError || !result) throw new Error(orderError?.message ?? 'Failed to create order');
  const order = result as unknown as { order_id: string; order_number: string; total_pesewas: number };

  // Stock is NOT deducted here: it comes out when staff confirm the payment.
  after(() => sendOrderEmail(order.order_id, 'placed'));

  return { orderId: order.order_id, orderNumber: order.order_number, totalPesewas: order.total_pesewas };
}

// What the checkout page calls. Returns { ok: true, ... } or { ok: false, error } so the real message shows in
// production (see lib/actionResult.ts).
export async function submitOrder(formData: FormData) {
  return runAction(() => placeOrder(formData));
}