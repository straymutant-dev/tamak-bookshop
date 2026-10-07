// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { createClient } from '@/lib/supabase/server';
import type { SaleResult } from '@/app/(admin)/admin/pos/Receipt';

export async function logReceiptPrint(orderId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('receipt_prints').insert({ order_id: orderId, staff_id: user.id });
  if (error) throw new Error(error.message);
}

export async function getReceiptForReprint(orderId: string): Promise<{ sale: SaleResult; cashierName: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: order, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, created_at, payment_method, payment_reference, contact_name, staff_id, order_items(quantity, unit_price_pesewas, books(title))'
    )
    .eq('id', orderId)
    .single();

  if (error || !order) throw new Error('Order not found');

  let cashierName = 'Tamak Bookshop';
  if (order.staff_id) {
    const { data: staffProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', order.staff_id)
      .single();
    cashierName = staffProfile?.full_name ?? cashierName;
  }

  const items = (order.order_items ?? []).map((item) => {
    const book = Array.isArray(item.books) ? item.books[0] : item.books;
    return {
      title: book?.title ?? 'Unknown title',
      quantity: item.quantity,
      unit_price_pesewas: item.unit_price_pesewas,
      line_total_pesewas: item.unit_price_pesewas * item.quantity,
    };
  });

  const totalPesewas = items.reduce((sum, i) => sum + i.line_total_pesewas, 0);

  const { error: printLogError } = await supabase
    .from('receipt_prints')
    .insert({ order_id: orderId, staff_id: user.id });
  if (printLogError) console.error('receipt print log failed:', printLogError.message);

  return {
    
    sale: {
      orderId: order.id,
      orderNumber: order.order_number,
      createdAt: order.created_at,
      items,
      totalPesewas,
      paymentMethod: order.payment_method,
      paymentReference: order.payment_reference,
      customerName: order.contact_name,
    },
    cashierName,
  };
}