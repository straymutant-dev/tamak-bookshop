// STRAYMUTANT.DEV — Tamak Bookshop
import { createClient } from '@/lib/supabase/server';
import VendorRow from './VendorRow';
import StatRow from '@/components/admin/StatRow';

const STATUS_PRIORITY: Record<string, number> = { pending: 0, approved: 1, frozen: 2, rejected: 3 };

export default async function VendorsPage() {
  const supabase = await createClient();

  const { data: vendorsRaw, error } = await supabase
    .from('profiles')
    .select('id, full_name, business_name, phone, vendor_status, credit_limit_pesewas, outstanding_balance_pesewas, created_at')
    .eq('role', 'vendor')
    .order('created_at', { ascending: false });

  // Pending approvals surface first — they're the ones needing action.
  const vendors = [...(vendorsRaw ?? [])].sort(
    (a, b) => (STATUS_PRIORITY[a.vendor_status] ?? 9) - (STATUS_PRIORITY[b.vendor_status] ?? 9)
  );

  const pendingCount = vendors.filter((v) => v.vendor_status === 'pending').length;
  const approvedCount = vendors.filter((v) => v.vendor_status === 'approved').length;

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-ink">Wholesale vendors</h1>
      <p className="mb-6 text-sm text-ink-muted">Pending approvals are listed first.</p>

      <StatRow
        stats={[
          { label: 'Total vendors', value: vendors.length },
          { label: 'Pending approval', value: pendingCount, accent: pendingCount > 0 ? 'terracotta' : undefined },
          { label: 'Approved', value: approvedCount, accent: 'green' },
        ]}
      />

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load vendors: {error.message}
        </p>
      )}

      <div className="overflow-hidden rounded-md border border-border-beige bg-surface-card">
        {vendors.map((vendor, i) => (
          <VendorRow key={vendor.id} vendor={vendor} isFirst={i === 0} />
        ))}
        {vendors.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-ink-muted">No vendor accounts yet.</div>
        )}
      </div>
    </div>
  );
}