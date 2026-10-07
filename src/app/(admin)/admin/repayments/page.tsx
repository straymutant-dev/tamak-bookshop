// STRAYMUTANT.DEV — Tamak Bookshop
import { createClient } from '@/lib/supabase/server';
import { formatGHS } from '@/lib/currency';
import RepaymentsClient from './RepaymentsClient';

export default async function RepaymentsPage() {
  const supabase = await createClient();

  const { data: vendors } = await supabase
    .from('profiles')
    .select('id, business_name, full_name, outstanding_balance_pesewas')
    .eq('role', 'vendor')
    .gt('outstanding_balance_pesewas', 0)
    .order('outstanding_balance_pesewas', { ascending: false });

  const { data: repayments, error } = await supabase
    .from('credit_repayments')
    .select('id, vendor_id, received_by_staff_id, amount_pesewas, payment_method, payment_reference, notes, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  const peopleIds = Array.from(
    new Set(
      [...(repayments ?? []).map((r) => r.vendor_id), ...(repayments ?? []).map((r) => r.received_by_staff_id)].filter(
        Boolean
      )
    )
  ) as string[];

  const namesById: Record<string, string> = {};
  if (peopleIds.length > 0) {
    const { data: people } = await supabase.from('profiles').select('id, full_name').in('id', peopleIds);
    for (const p of people ?? []) namesById[p.id] = p.full_name ?? 'Unknown';
  }

  const vendorOptions = (vendors ?? []).map((v) => ({
    id: v.id,
    name: v.business_name || v.full_name,
    outstandingBalancePesewas: v.outstanding_balance_pesewas,
  }));

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold text-ink">Vendor repayments</h1>
      <p className="mb-6 text-sm text-ink-muted">Record wholesale credit repayments from vendors.</p>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load repayments: {error.message}
        </p>
      )}

      <RepaymentsClient vendors={vendorOptions} />

      <h2 className="mb-3 mt-10 text-lg font-semibold text-ink">Recent repayments</h2>
      <div className="overflow-x-auto rounded-md border border-border-beige bg-surface-card">
        <table className="w-full text-sm">
          <thead className="bg-surface-cream text-left text-ink-muted">
            <tr>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Recorded by</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {(repayments ?? []).map((r) => (
              <tr key={r.id} className="border-t border-border-beige">
                <td className="px-4 py-3 text-ink">{r.vendor_id ? namesById[r.vendor_id] ?? 'Vendor' : 'Vendor'}</td>
                <td className="px-4 py-3 text-ink">{formatGHS(r.amount_pesewas)}</td>
                <td className="px-4 py-3 text-ink-muted capitalize">
                  {r.payment_method.replace('_', ' ')}
                  {r.payment_reference && <span className="ml-1 text-xs">({r.payment_reference})</span>}
                </td>
                <td className="px-4 py-3 text-ink-muted">
                  {r.received_by_staff_id ? namesById[r.received_by_staff_id] ?? 'Staff' : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-ink-muted">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {(repayments ?? []).length === 0 && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-muted">
                  No repayments recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}