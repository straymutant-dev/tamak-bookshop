// STRAYMUTANT.DEV — Tamak Bookshop
import { createClient } from '@/lib/supabase/server';
import ApprovalRow from './ApprovalRow';

export default async function ApprovalsPage() {
  const supabase = await createClient();

  const { data: pending, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, user_id, subtotal_pesewas, total_pesewas, created_at, order_items(quantity, unit_price_pesewas, books(title))'
    )
    .eq('payment_status', 'credit_pending')
    .order('created_at', { ascending: true });

  const vendorIds = Array.from(new Set((pending ?? []).map((o) => o.user_id).filter(Boolean))) as string[];
  const vendorsById: Record<string, { name: string; available: number }> = {};
  if (vendorIds.length > 0) {
    const { data: vendors } = await supabase
      .from('profiles')
      .select('id, business_name, full_name, credit_limit_pesewas, outstanding_balance_pesewas')
      .in('id', vendorIds);
    for (const v of vendors ?? []) {
      vendorsById[v.id] = {
        name: v.business_name || v.full_name,
        available: Math.max(0, (v.credit_limit_pesewas ?? 0) - (v.outstanding_balance_pesewas ?? 0)),
      };
    }
  }

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold text-ink">Wholesale credit approvals</h1>
      <p className="mb-6 text-sm text-ink-muted">Pending vendor credit orders awaiting review.</p>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load pending orders: {error.message}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {(pending ?? []).map((order) => (
          <ApprovalRow
            key={order.id}
            order={order}
            vendorName={order.user_id ? vendorsById[order.user_id]?.name ?? 'Vendor' : 'Vendor'}
            vendorAvailableCredit={order.user_id ? vendorsById[order.user_id]?.available ?? 0 : 0}
          />
        ))}
        {(pending ?? []).length === 0 && !error && (
          <p className="text-sm text-ink-muted">No pending credit orders.</p>
        )}
      </div>
    </div>
  );
}