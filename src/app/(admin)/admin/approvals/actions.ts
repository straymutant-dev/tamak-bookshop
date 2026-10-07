// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

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

  // --- Checks first: nothing is changed until every check passes ---------------
  const service = createServiceRoleClient();

  // Staff can't read/update another user's balance through RLS-checked writes,
  // so the vendor's credit figures are handled with the service-role client
  // (the staff/admin check in assertStaffOrAdmin() has already passed).
  const { data: vendor } = await service
    .from('profiles')
    .select('outstanding_balance_pesewas, credit_limit_pesewas')
    .eq('id', order.user_id)
    .eq('role', 'vendor')
    .single();

  if (!vendor) throw new Error('Vendor account not found');

  if (vendor.outstanding_balance_pesewas + order.total_pesewas > vendor.credit_limit_pesewas) {
    throw new Error(
      `Approving this order would put the vendor over their credit limit ` +
        `(owes ${(vendor.outstanding_balance_pesewas / 100).toFixed(2)} GHS, limit ${(vendor.credit_limit_pesewas / 100).toFixed(2)} GHS). ` +
        `Raise the limit on the vendor page first, or reject the order.`
    );
  }

  const bookIds = order.order_items.map((i) => i.book_id);
  const { data: stockRows, error: stockReadError } = await supabase
    .from('books')
    .select('id, title, stock_quantity')
    .in('id', bookIds);
  if (stockReadError) throw new Error(stockReadError.message);

  for (const item of order.order_items) {
    const book = stockRows?.find((b) => b.id === item.book_id);
    if (!book) throw new Error('A book in this order no longer exists');
    if (book.stock_quantity < item.quantity) {
      throw new Error(`Not enough stock for "${book.title}" (${book.stock_quantity} left, ${item.quantity} ordered)`);
    }
  }

  // --- Changes ----------------------------------------------------------------
  // The status flip is guarded: if someone else approved/rejected it a moment
  // ago, zero rows match and we stop before touching stock or balance.
  const { data: flipped, error: statusError } = await supabase
    .from('orders')
    .update({ payment_status: 'credit_approved' })
    .eq('id', orderId)
    .eq('payment_status', 'credit_pending')
    .select('id');

  if (statusError) throw new Error(statusError.message);
  if (!flipped?.length) throw new Error('This order has already been reviewed');

  for (const item of order.order_items) {
    const { error: stockError } = await supabase.rpc('decrement_book_stock', {
      book_id: item.book_id,
      qty: item.quantity,
    });
    if (stockError) throw new Error(`Stock update failed: ${stockError.message}`);
  }

  const { data: updated, error: balanceError } = await service
    .from('profiles')
    .update({ outstanding_balance_pesewas: vendor.outstanding_balance_pesewas + order.total_pesewas })
    .eq('id', order.user_id)
    .eq('role', 'vendor')
    .select('id');

  if (balanceError) throw new Error(balanceError.message);
  if (!updated?.length) throw new Error('Could not update the vendor balance');

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