// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function assertStaffOrAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin' && profile?.role !== 'staff') {
    throw new Error('Only staff or admin can review credit orders');
  }

  return { supabase, staffId: user.id };
}

export async function approveVendorOrder(orderId: string) {
  const { supabase } = await assertStaffOrAdmin();
  const { data: order } = await supabase
    .from('orders')
    .select('id, fulfillment_type')
    .eq('id', orderId)
    .single();
  if (!order) throw new Error('Order not found');

  const { error } = await supabase.rpc('approve_vendor_credit_order', {
    p_order_id: orderId,
    p_fulfillment: order.fulfillment_type ?? 'pickup',
  });
  if (error) throw new Error(error.message);

  revalidatePath('/admin/approvals');
  revalidatePath('/admin/orders');
  revalidatePath('/admin/inventory');
  revalidatePath('/vendor/dashboard');
}

export async function rejectVendorOrder(orderId: string) {
  const { supabase, staffId } = await assertStaffOrAdmin();

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, order_number, user_id, total_pesewas, payment_status')
    .eq('id', orderId)
    .single();

  if (orderError || !order) throw new Error('Order not found');
  if (order.payment_status !== 'credit_pending') throw new Error('This order has already been reviewed');

  await supabase.from('audit_logs').insert({
    staff_id: staffId,
    action: 'vendor_order_rejected',
    entity_type: 'orders',
    entity_id: orderId,
    details_json: { orderNumber: order.order_number, amountPesewas: order.total_pesewas },
  });

  const { error: deleteError } = await supabase.from('orders').delete().eq('id', orderId);
  if (deleteError) throw new Error(deleteError.message);

  revalidatePath('/admin/approvals');
  revalidatePath('/admin/orders');
}