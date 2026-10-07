// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState, useTransition } from 'react';
import { formatGHS } from '@/lib/currency';
import { recordRepayment } from './actions';
import { useToast } from '@/components/ui/ToastContext';

interface VendorOption {
  id: string;
  name: string;
  outstandingBalancePesewas: number;
}

const PAY_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
];

export default function RepaymentsClient({ vendors }: { vendors: VendorOption[] }) {
  const [open, setOpen] = useState(false);
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? '');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const selectedVendor = vendors.find((v) => v.id === vendorId);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await recordRepayment(formData);
        showToast('Repayment recorded');
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      }
    });
  }

  if (vendors.length === 0) {
    return <p className="text-sm text-ink-muted">No vendors currently owe a balance.</p>;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white"
      >
        Record repayment
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-surface-card p-6">
            <h2 className="mb-4 text-lg font-semibold text-ink">Record a repayment</h2>

            {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <form action={handleSubmit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                Vendor
                <select
                  name="vendorId"
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  className="rounded-md border border-brand-sage px-3 py-2"
                >
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} — owes {formatGHS(v.outstandingBalancePesewas)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                Amount (GHS)
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedVendor ? selectedVendor.outstandingBalancePesewas / 100 : undefined}
                  required
                  className="rounded-md border border-brand-sage px-3 py-2"
                />
                {selectedVendor && (
                  <span className="text-xs text-ink-muted">
                    Balance owed: {formatGHS(selectedVendor.outstandingBalancePesewas)}
                  </span>
                )}
              </label>

              <label className="flex flex-col gap-1 text-sm">
                Payment method
                <select
                  name="paymentMethod"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="rounded-md border border-brand-sage px-3 py-2"
                >
                  {PAY_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>

              {(paymentMethod === 'mobile_money' || paymentMethod === 'cheque') && (
                <label className="flex flex-col gap-1 text-sm">
                  {paymentMethod === 'cheque' ? 'Cheque number' : 'Transaction ID'}
                  <input name="paymentReference" className="rounded-md border border-brand-sage px-3 py-2" />
                </label>
              )}

              <label className="flex flex-col gap-1 text-sm">
                Notes (optional)
                <textarea name="notes" rows={2} className="rounded-md border border-brand-sage px-3 py-2" />
              </label>

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-border-beige px-4 py-2 text-sm text-ink-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-brand-green px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}