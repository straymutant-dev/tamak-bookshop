// STRAYMUTANT.DEV — Tamak Bookshop
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const { orderNumber, phone } = await request.json();

  if (!orderNumber || !phone) {
    return NextResponse.json({ error: 'Order number and phone are required' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: order, error } = await supabase
    .from('orders')
    .select(
      'order_number, payment_method, payment_status, total_pesewas, discount_pesewas, fulfillment_type, order_status, created_at, order_items(quantity, unit_price_pesewas, books(title))'
    )
    .eq('order_number', orderNumber)
    .eq('contact_phone', phone)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: 'No matching order found' }, { status: 404 });
  }

  return NextResponse.json({ order });
}