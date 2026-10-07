// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { createClient } from '@/lib/supabase/server';
import type { OrderDetails } from '@/lib/orderDetailsTypes';

/**
 * The exact books on one order. Uses the signed-in user's own session, so the
 * database rules decide who can see what: customers and vendors see only their
 * own orders; staff and admins see every order.
 */
export async function getOrderDetails(orderId: string): Promise<OrderDetails> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Please log in again');

  const { data: order, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, created_at, payment_method, payment_status, payment_reference, cheque_number, fulfillment_type, order_status, subtotal_pesewas, discount_pesewas, total_pesewas, contact_name, contact_phone, order_items(id, quantity, unit_price_pesewas, line_total_pesewas, books(title, author))'
    )
    .eq('id', orderId)
    .single();

  if (error || !order) throw new Error('Order not found');

  return {
    id: order.id,
    orderNumber: order.order_number,
    createdAt: order.created_at,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    paymentReference: order.payment_reference,
    chequeNumber: order.cheque_number,
    fulfillmentType: order.fulfillment_type,
    orderStatus: order.order_status,
    subtotalPesewas: order.subtotal_pesewas,
    discountPesewas: order.discount_pesewas,
    totalPesewas: order.total_pesewas,
    contactName: order.contact_name,
    contactPhone: order.contact_phone,
    items: (order.order_items ?? []).map((item) => {
      const book = Array.isArray(item.books) ? item.books[0] : item.books;
      return {
        id: item.id,
        title: book?.title ?? 'Unknown title',
        author: book?.author ?? null,
        quantity: item.quantity,
        unitPricePesewas: item.unit_price_pesewas,
        linePesewas: item.line_total_pesewas,
      };
    }),
  };
}