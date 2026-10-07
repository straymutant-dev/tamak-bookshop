// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

/**
 * "I've paid — here's my transaction ID." Staff are notified, and the reference
 * is pre-filled when they confirm the payment.
 *
 * Signed-in customers/vendors report on their own order (the database checks it
 * is theirs). Guests have no account, so they prove it's their order with the
 * order number AND the phone number they ordered with.
 */
export async function reportPayment(input: {
  orderId?: string;
  orderNumber?: string;
  phone?: string;
  reference: string;
}) {
  const reference = input.reference.trim();
  if (!reference) throw new Error('Enter the payment reference or transaction ID');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && input.orderId) {
    const { error } = await supabase.rpc('report_order_payment', {
      p_order_id: input.orderId,
      p_reference: reference,
    });
    if (error) throw new Error(error.message);
  } else {
    if (!input.orderNumber || !input.phone) throw new Error('Order number and phone are required');

    const service = createServiceRoleClient();
    const { data: order } = await service
      .from('orders')
      .select('id, payment_status, user_id')
      .eq('order_number', input.orderNumber)
      .eq('contact_phone', input.phone)
      .single();

    if (!order || order.user_id !== null) throw new Error('No matching order found');
    if (order.payment_status !== 'payment_pending') throw new Error('This order is not waiting for payment');

    const { error } = await service
      .from('orders')
      .update({ payment_reference: reference, payment_reported_at: new Date().toISOString() })
      .eq('id', order.id);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/admin/orders');
}