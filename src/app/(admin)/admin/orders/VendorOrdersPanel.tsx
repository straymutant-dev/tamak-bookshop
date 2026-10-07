// STRAYMUTANT.DEV — Tamak Bookshop
import { createClient } from '@/lib/supabase/server';
import VendorOrderCard from './VendorOrderCard';

/**
 * Online orders waiting for staff: vendor credit orders to approve, and vendor or
 * customer orders paid by Mobile Money / bank / cash / cheque that need the payment
 * confirmed. Customers who say they've paid have their reference pre-filled.
 */
export default async function VendorOrdersPanel() {
  const supabase = await createClient();

  const { data: orders, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, order_type, user_id, payment_method, payment_reference, payment_reported_at, payment_status, fulfillment_type, total_pesewas, contact_name, contact_phone, created_at, order_items(quantity, unit_price_pesewas, line_total_pesewas, books(title))'
    )
    .in('order_type', ['storefront_vendor', 'storefront_client'])
    .in('payment_status', ['credit_pending', 'payment_pending'])
    .order('created_at', { ascending: true });

  const userIds = Array.from(new Set((orders ?? []).map((o) => o.user_id).filter(Boolean))) as string[];
  const vendorsById: Record<string, { name: string; limit: number; owed: number }> = {};
  if (userIds.length > 0) {
    const { data: people } = await supabase
      .from('profiles')
      .select('id, business_name, full_name, credit_limit_pesewas, outstanding_balance_pesewas')
      .in('id', userIds);
    for (const v of people ?? []) {
      vendorsById[v.id] = {
        name: v.business_name || v.full_name || 'Customer',
        limit: v.credit_limit_pesewas ?? 0,
        owed: v.outstanding_balance_pesewas ?? 0,
      };
    }
  }

  return (
    <div>
      <p className="mb-6 text-sm text-ink-muted">
        Orders waiting for you. Credit orders need approval. Orders paid by Mobile Money, bank, cash or cheque are marked
        paid only after you confirm the payment with its reference. When a customer says they have paid, their
        reference is filled in for you to check against your account.
      </p>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load orders: {error.message}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {(orders ?? []).map((order) => {
          const account = order.user_id ? vendorsById[order.user_id] : undefined;
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
                paymentReportedAt: order.payment_reported_at,
                contactPhone: order.contact_phone,
                kind: order.order_type === 'storefront_vendor' ? 'vendor' : 'customer',
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
              vendor={{
                name: account?.name ?? order.contact_name ?? 'Customer',
                limitPesewas: account?.limit ?? 0,
                owedPesewas: account?.owed ?? 0,
              }}
            />
          );
        })}
        {(orders ?? []).length === 0 && !error && (
          <p className="rounded-md border border-border-beige bg-surface-card px-4 py-8 text-center text-sm text-ink-muted">
            Nothing waiting. You&rsquo;re all caught up.
          </p>
        )}
      </div>
    </div>
  );
}