// STRAYMUTANT.DEV — Tamak Bookshop
import { createClient } from '@/lib/supabase/server';
import { formatGHS } from '@/lib/currency';
import RepaymentsClient from './RepaymentsClient';
import RequestCard from './RequestCard';
import { Check } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';

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

  const { data: pendingRequests } = await supabase
    .from('repayment_requests')
    .select('id, vendor_id, amount_pesewas, payment_method, payment_reference, contact_phone, notes, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  const requestVendorIds = Array.from(new Set((pendingRequests ?? []).map((r) => r.vendor_id)));
  const requestVendors: Record<string, { name: string; owed: number }> = {};
  if (requestVendorIds.length > 0) {
    const { data: reqVendors } = await supabase
      .from('profiles')
      .select('id, business_name, full_name, outstanding_balance_pesewas')
      .in('id', requestVendorIds);
    for (const v of reqVendors ?? []) {
      requestVendors[v.id] = { name: v.business_name || v.full_name || 'Vendor', owed: v.outstanding_balance_pesewas ?? 0 };
    }
  }

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
      <p className="mb-6 text-sm text-ink-muted">
        A vendor&rsquo;s balance only goes down once you confirm the payment, with its reference.
      </p>

      <h2 className="mb-3 text-lg font-semibold text-ink">
        Payments waiting for confirmation
        {(pendingRequests ?? []).length > 0 && (
          <span className="ml-2 rounded-full bg-accent-terracotta px-2 py-0.5 text-xs font-medium text-white">
            {(pendingRequests ?? []).length}
          </span>
        )}
      </h2>
      <div className="mb-10 flex flex-col gap-4">
        {(pendingRequests ?? []).map((r) => (
          <RequestCard
            key={r.id}
            request={{
              id: r.id,
              amountPesewas: r.amount_pesewas,
              paymentMethod: r.payment_method,
              paymentReference: r.payment_reference,
              contactPhone: r.contact_phone,
              notes: r.notes,
              createdAt: r.created_at,
            }}
            vendor={{
              name: requestVendors[r.vendor_id]?.name ?? 'Vendor',
              owedPesewas: requestVendors[r.vendor_id]?.owed ?? 0,
            }}
          />
        ))}
        {(pendingRequests ?? []).length === 0 && (
          <EmptyState
          compact
          icon={<Check size={22} />}
          title="No payments to confirm"
          body="When a vendor reports a payment, it shows up here."
           />
         )}
      </div>

      <h2 className="mb-3 text-lg font-semibold text-ink">Record a payment received in person</h2>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load repayments: {error.message}
        </p>
      )}

      <RepaymentsClient vendors={vendorOptions} />

      <h2 className="mb-3 mt-10 text-lg font-semibold text-ink">Confirmed repayments</h2>
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