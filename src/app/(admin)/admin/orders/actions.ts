// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ghsToPesewas } from '@/lib/currency';

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

  const fulfillmentType = formData.get('fulfillmentType') as string;
  const orderStatus = formData.get('orderStatus') as string;
  const discountGhs = formData.get('discount') as string;
  const paymentMethod = formData.get('paymentMethod') as string;
  const paymentReference = formData.get('paymentReference') as string;
  const chequeNumber = formData.get('chequeNumber') as string;
  const chequeCleared = formData.get('chequeCleared') as string;

  const updates: Record<string, unknown> = {
    fulfillment_type: fulfillmentType,
    order_status: orderStatus,
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
    details_json: updates,
  });

  revalidatePath('/admin/orders');
  revalidatePath('/account/orders');
  revalidatePath('/store/track');
}