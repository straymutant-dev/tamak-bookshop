// STRAYMUTANT.DEV — Tamak Bookshop
import { createClient } from '@/lib/supabase/server';
import VendorOrderCard from './VendorOrderCard';

export default async function VendorOrdersPanel() {
  const supabase = await createClient();

  const { data: orders, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, user_id, payment_method, payment_reference, payment_status, fulfillment_type, total_pesewas, contact_phone, created_at, order_items(quantity, unit_price_pesewas, line_total_pesewas, books(title))'
    )
    .eq('order_type', 'storefront_vendor')
    .in('payment_status', ['credit_pending', 'payment_pending'])
    .order('created_at', { ascending: true });

  const vendorIds = Array.from(new Set((orders ?? []).map((o) => o.user_id).filter(Boolean))) as string[];
  const vendorsById: Record<string, { name: string; limit: number; owed: number }> = {};
  if (vendorIds.length > 0) {
    const { data: vendors } = await supabase
      .from('profiles')
      .select('id, business_name, full_name, credit_limit_pesewas, outstanding_balance_pesewas')
      .in('id', vendorIds);
    for (const v of vendors ?? []) {
      vendorsById[v.id] = {
        name: v.business_name || v.full_name || 'Vendor',
        limit: v.credit_limit_pesewas ?? 0,
        owed: v.outstanding_balance_pesewas ?? 0,
      };
    }
  }

  return (
    <div>
      <p className="mb-6 text-sm text-ink-muted">
        Wholesale orders waiting for you. Credit orders need approval; pay-now orders are marked paid only after you
        confirm the payment with its reference.
      </p>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load vendor orders: {error.message}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {(orders ?? []).map((order) => {
          const vendor = (order.user_id && vendorsById[order.user_id]) || { name: 'Vendor', limit: 0, owed: 0 };
          return (
            <VendorOrderCard
              key={order.id}
              order={{
                id: order.id,
                orderNumber: order.order_number,
                createdAt: order.created_at,
                fulfillmentType: order.fulfillment_type,
                totalPesewas: order.total_pesewas,
                paymentStatus: order.payment_status,
                paymentMethod: order.payment_method,
                paymentReference: order.payment_reference,
                contactPhone: order.contact_phone,
                items: order.order_items.map((item) => {
                  const book = Array.isArray(item.books) ? item.books[0] : item.books;
                  return {
                    title: book?.title ?? 'Unknown title',
                    quantity: item.quantity,
                    unitPricePesewas: item.unit_price_pesewas,
                    linePesewas: item.line_total_pesewas,
                  };
                }),
              }}
              vendor={{ name: vendor.name, limitPesewas: vendor.limit, owedPesewas: vendor.owed }}
            />
          );
        })}
        {(orders ?? []).length === 0 && !error && (
          <p className="rounded-md border border-border-beige bg-surface-card px-4 py-8 text-center text-sm text-ink-muted">
            No vendor orders waiting.
          </p>
        )}
      </div>
    </div>
  );
}