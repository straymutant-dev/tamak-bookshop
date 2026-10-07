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
  const { supabase, staffId } = await assertStaffOrAdmin();

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, order_number, user_id, total_pesewas, payment_status, order_items(book_id, quantity)')
    .eq('id', orderId)
    .single();

  if (orderError || !order) throw new Error('Order not found');
  if (order.payment_status !== 'credit_pending') throw new Error('This order has already been reviewed');
  if (!order.user_id) throw new Error('This order has no vendor attached');

  const { error: statusError } = await supabase
    .from('orders')
    .update({ payment_status: 'credit_approved' })
    .eq('id', orderId)
    .eq('payment_status', 'credit_pending');

  if (statusError) throw new Error(statusError.message);

  for (const item of order.order_items) {
    const { error: stockError } = await supabase.rpc('decrement_book_stock', {
      book_id: item.book_id,
      qty: item.quantity,
    });
    if (stockError) throw new Error(`Stock update failed: ${stockError.message}`);
  }

  const { data: vendor } = await supabase
    .from('profiles')
    .select('outstanding_balance_pesewas')
    .eq('id', order.user_id)
    .single();

  const { error: balanceError } = await supabase
    .from('profiles')
    .update({ outstanding_balance_pesewas: (vendor?.outstanding_balance_pesewas ?? 0) + order.total_pesewas })
    .eq('id', order.user_id);

  if (balanceError) throw new Error(balanceError.message);

  await supabase.from('audit_logs').insert({
    staff_id: staffId,
    action: 'vendor_order_approved',
    entity_type: 'orders',
    entity_id: orderId,
    details_json: { orderNumber: order.order_number, amountPesewas: order.total_pesewas },
  });

  revalidatePath('/admin/approvals');
  revalidatePath('/admin/orders');
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