// STRAYMUTANT.DEV — Tamak Bookshop
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { phonesMatch } from '@/lib/phone';
import { fetchPaymentAccounts } from '@/lib/paymentAccounts';

export async function POST(request: Request) {
  const body = await request.json();
  const orderNumber = String(body?.orderNumber ?? '').trim();
  const phone = String(body?.phone ?? '').trim();

  if (!orderNumber || !phone) {
    return NextResponse.json({ error: 'Order number and phone are required' }, { status: 400 });
  }
  // The order number is matched case-insensitively below; keep wildcard characters out of it.
  if (/[%_\\]/.test(orderNumber)) {
    return NextResponse.json({ error: 'No matching order found' }, { status: 404 });
  }

  const supabase = createServiceRoleClient();

  const { data: order, error } = await supabase
    .from('orders')
    .select(
      'order_number, payment_method, payment_status, payment_reference, payment_reported_at, cheque_number, user_id, contact_phone, total_pesewas, discount_pesewas, fulfillment_type, order_status, created_at, order_items(quantity, unit_price_pesewas, books(title))'
    )
    .ilike('order_number', orderNumber)
    .limit(1)
    .maybeSingle();

  // Order number + phone together prove it is the customer's order.
  if (error || !order || !phonesMatch(order.contact_phone, phone)) {
    return NextResponse.json({ error: 'No matching order found' }, { status: 404 });
  }

  // Unpaid orders also get the shop's payment details so the customer can still pay.
  const awaitingPayment = order.payment_status === 'payment_pending';
  const paymentAccounts = awaitingPayment ? await fetchPaymentAccounts(supabase) : [];

  // Never send the phone number or account id back out.
  const { user_id, contact_phone, ...safeOrder } = order;
  void contact_phone;

  return NextResponse.json({
    order: { ...safeOrder, can_report: user_id === null },
    paymentAccounts,
  });
}