// STRAYMUTANT.DEV — Tamak Bookshop
import { createClient } from '@/lib/supabase/server';
import OrdersTable from './OrdersTable';

export default async function OrdersPage() {
  const supabase = await createClient();

  const { data: orders, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, order_type, payment_method, payment_status, total_pesewas, discount_pesewas, fulfillment_type, order_status, payment_reference, cheque_number, cheque_cleared, contact_name, user_id, staff_id, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(100);

  const staffIds = Array.from(new Set((orders ?? []).map((o) => o.staff_id).filter(Boolean))) as string[];
  const customerIds = Array.from(new Set((orders ?? []).map((o) => o.user_id).filter(Boolean))) as string[];
  const allIds = Array.from(new Set([...staffIds, ...customerIds]));

  const namesById: Record<string, string> = {};
  if (allIds.length > 0) {
    const { data: people } = await supabase.from('profiles').select('id, full_name').in('id', allIds);
    for (const person of people ?? []) {
      namesById[person.id] = person.full_name ?? 'Unknown';
    }
  }

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold text-ink">Orders & sales</h1>
      <p className="mb-6 text-sm text-ink-muted">Every sale on the platform, most recent first.</p>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load orders: {error.message}
        </p>
      )}

      <OrdersTable orders={orders ?? []} namesById={namesById} />
    </div>
  );
}