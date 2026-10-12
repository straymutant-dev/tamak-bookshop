// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ghsToPesewas } from '@/lib/currency';
import type { Database, Json } from '@/lib/database.types';

async function assertStaffOrAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin' && profile?.role !== 'staff') {
    throw new Error('Only staff or admin can manage orders');
  }

  return { supabase, staffId: user.id };
}

export async function updateOrderStatus(orderId: string, formData: FormData) {
  const { supabase, staffId } = await assertStaffOrAdmin();

  // Read the order's own current state rather than trust the form — a
  // disabled input in the UI is not a security boundary, this is.
  const { data: existing, error: fetchError } = await supabase
    .from('orders')
    .select('payment_status, fulfillment_type, delivery_address, delivery_notes')
    .eq('id', orderId)
    .single();
  if (fetchError || !existing) throw new Error(fetchError?.message ?? 'Order not found');

  // Once staff have confirmed payment or approved credit, the fulfillment
  // method and delivery details are frozen: whatever the form sends for
  // them is ignored and the existing values are kept as-is.
  const isConfirmed = existing.payment_status !== 'payment_pending' && existing.payment_status !== 'credit_pending';

  let fulfillmentType: string;
  let deliveryAddress: string | null;
  let deliveryNotes: string | null;

  if (isConfirmed) {
    fulfillmentType = existing.fulfillment_type;
    deliveryAddress = existing.delivery_address;
    deliveryNotes = existing.delivery_notes;
  } else {
    fulfillmentType = formData.get('fulfillmentType') as string;
    if (fulfillmentType === 'delivery') {
      deliveryAddress = String(formData.get('deliveryAddress') ?? '').trim();
      if (!deliveryAddress) throw new Error('Enter where this order should be delivered to');
      deliveryNotes = String(formData.get('deliveryNotes') ?? '').trim() || null;
    } else {
      deliveryAddress = null;
      deliveryNotes = null;
    }
  }

  const orderStatus = formData.get('orderStatus') as string;
  const discountGhs = formData.get('discount') as string;
  const paymentMethod = formData.get('paymentMethod') as string;
  const paymentReference = formData.get('paymentReference') as string;
  const chequeNumber = formData.get('chequeNumber') as string;
  const chequeCleared = formData.get('chequeCleared') as string;

  type OrderUpdate = Database['public']['Tables']['orders']['Update'];
  const updates: OrderUpdate = {
    fulfillment_type: fulfillmentType as OrderUpdate['fulfillment_type'],
    delivery_address: deliveryAddress,
    delivery_notes: deliveryNotes,
    order_status: orderStatus as OrderUpdate['order_status'],
    discount_pesewas: discountGhs ? ghsToPesewas(Number(discountGhs)) : 0,
  };

  if (paymentMethod === 'mobile_money') {
    updates.payment_reference = paymentReference || null;
  }

  if (paymentMethod === 'cheque') {
    updates.cheque_number = chequeNumber || null;
    updates.cheque_cleared = chequeCleared === '' ? null : chequeCleared === 'true';
  }

  const { error } = await supabase.from('orders').update(updates).eq('id', orderId);
  if (error) throw new Error(error.message);

  await supabase.from('audit_logs').insert({
    staff_id: staffId,
    action: 'order_status_updated',
    entity_type: 'orders',
    entity_id: orderId,
    details_json: updates as Json,
  });

  revalidatePath('/admin/orders');
  revalidatePath('/account/orders');
  revalidatePath('/store/track');
}