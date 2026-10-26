// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  RETURN_WINDOW_DAYS,
  RETURNABLE_PAYMENT_STATUSES,
  returnDeadline,
  type ReturnInfo,
  type ReturnResult,
} from '@/lib/returns';

async function assertStaffOrAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin' && profile?.role !== 'staff') {
    throw new Error('Only staff or admin can process returns');
  }
  return { supabase };
}

/** What can still be returned on this order, and whether returns are allowed at all. */
export async function getReturnInfo(orderId: string): Promise<ReturnInfo> {
  const { supabase } = await assertStaffOrAdmin();

  const { data: order, error } = await supabase
    .from('orders')
    .select(
      'order_number, order_status, payment_status, payment_method, order_type, user_id, cheque_number, created_at, subtotal_pesewas, total_pesewas'
    )
    .eq('id', orderId)
    .single();
  if (error || !order) throw new Error(error?.message ?? 'Order not found');

  const [{ data: lines }, { data: returns }] = await Promise.all([
    supabase.from('order_items').select('book_id, quantity, line_total_pesewas').eq('order_id', orderId),
    supabase.from('order_returns').select('book_id, quantity').eq('order_id', orderId),
  ]);

  const sold = new Map<string, { quantity: number; paid: number }>();
  for (const line of lines ?? []) {
    const entry = sold.get(line.book_id) ?? { quantity: 0, paid: 0 };
    entry.quantity += line.quantity;
    entry.paid += line.line_total_pesewas;
    sold.set(line.book_id, entry);
  }

  const returned = new Map<string, number>();
  for (const r of returns ?? []) returned.set(r.book_id, (returned.get(r.book_id) ?? 0) + r.quantity);

  const bookIds = Array.from(sold.keys());
  const titles = new Map<string, string>();
  if (bookIds.length > 0) {
    const { data: books } = await supabase.from('books').select('id, title').in('id', bookIds);
    for (const b of books ?? []) titles.set(b.id, b.title);
  }

  // Same sums as the database, so the estimate shown matches what is recorded.
  const discountFactor = order.subtotal_pesewas > 0 ? order.total_pesewas / order.subtotal_pesewas : 1;
  const items = bookIds.map((bookId) => {
    const s = sold.get(bookId)!;
    const already = returned.get(bookId) ?? 0;
    return {
      bookId,
      title: titles.get(bookId) ?? 'Book',
      sold: s.quantity,
      returned: already,
      remaining: s.quantity - already,
      unitRefundPesewas: Math.round((s.paid / s.quantity) * discountFactor),
    };
  });

  const deadline = returnDeadline(order.created_at);
  let blockedReason: string | null = null;
  if (order.order_status !== 'completed') {
    blockedReason = 'Only completed orders can have returns.';
  } else if (!RETURNABLE_PAYMENT_STATUSES.includes(order.payment_status)) {
    blockedReason = 'Payment has not been confirmed for this order yet.';
  } else if (Date.now() > deadline.getTime()) {
    blockedReason = `Returns are accepted within ${RETURN_WINDOW_DAYS} days of the sale. This order passed that on ${deadline.toLocaleDateString()}.`;
  } else if (
    order.order_type === 'counter_pos' &&
    !order.user_id &&
    order.payment_method === 'credit' &&
    order.cheque_number
  ) {
    blockedReason = 'A cheque has been recorded for this order. Process the return once the cheque has cleared or bounced.';
  } else if (items.every((i) => i.remaining <= 0)) {
    blockedReason = 'Everything on this order has already been returned.';
  }

  return {
    orderNumber: order.order_number,
    totalPesewas: order.total_pesewas,
    items,
    deadline: deadline.toISOString(),
    blockedReason,
  };
}

export async function processReturn(
  orderId: string,
  items: { bookId: string; quantity: number; condition: 'resellable' | 'damaged' }[],
  notes: string
): Promise<ReturnResult> {
  const { supabase } = await assertStaffOrAdmin();

  const cleaned = items
    .filter((i) => i.quantity > 0)
    .map((i) => ({ bookId: i.bookId, quantity: Math.floor(i.quantity), condition: i.condition }));
  if (cleaned.length === 0) throw new Error('Choose at least one book to return');

  // The database re-checks everything (status, 7 days, quantities, refund amount).
  const { data, error } = await (supabase.rpc as any)('process_order_return', {
    p_order_id: orderId,
    p_items: cleaned,
    p_notes: notes.trim() || undefined,
  });
  if (error) throw new Error(error.message);

  revalidatePath('/admin/orders');
  revalidatePath('/admin/inventory');
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/activity');

  return data as unknown as ReturnResult;
}