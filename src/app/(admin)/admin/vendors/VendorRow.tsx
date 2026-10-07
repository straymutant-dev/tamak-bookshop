// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import type { VendorProfile } from '@/lib/types';
import { formatGHS } from '@/lib/currency';
import UserAvatar from '@/components/ui/UserAvatar';
import { setVendorCreditLimit, setVendorStatus } from './actions';
import { useToast } from '@/components/ui/ToastContext';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-accent-gold/20 text-accent-gold',
  approved: 'bg-brand-green/10 text-brand-green',
  rejected: 'bg-red-50 text-red-700',
  frozen: 'bg-ink/10 text-ink-muted',
};

export default function VendorRow({ vendor, isFirst }: { vendor: VendorProfile; isFirst?: boolean }) {
  const [editingLimit, setEditingLimit] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const available = Math.max(0, vendor.credit_limit_pesewas - vendor.outstanding_balance_pesewas);

  function handleLimitSubmit(formData: FormData) {
    setError(null);
    formData.set('vendorId', vendor.id);
    startTransition(async () => {
      try {
        await setVendorCreditLimit(formData);
        setEditingLimit(false);
        showToast('Credit limit updated');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update credit limit');
      }
    });
  }

  function handleStatus(status: 'approved' | 'frozen' | 'rejected') {
    setError(null);
    startTransition(async () => {
      try {
        await setVendorStatus(vendor.id, status);
        if (status === 'approved' && vendor.credit_limit_pesewas === 0) {
          setEditingLimit(true);
          showToast('Vendor approved — now set a credit limit');
        } else {
          showToast(
            status === 'approved' ? 'Vendor approved' : status === 'frozen' ? 'Vendor frozen' : 'Vendor rejected'
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update status');
      }
    });
  }

  return (
    <div className={`px-4 py-4 ${!isFirst ? 'border-t border-border-beige' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <UserAvatar fullName={vendor.full_name} className="mt-0.5 h-9 w-9 text-sm" asLink={false} />
          <div>
            <Link
              href={`/admin/vendors/${vendor.id}`}
              className="text-sm font-medium text-ink hover:text-brand-green hover:underline"
            >
              {vendor.business_name ?? vendor.full_name}
            </Link>
            <div className="text-xs text-ink-muted">
              {vendor.full_name} · {vendor.phone}
            </div>
            {error && <div className="mt-1 text-xs text-red-700">{error}</div>}
          </div>
        </div>

        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            STATUS_STYLES[vendor.vendor_status] ?? 'bg-surface-cream text-ink-muted'
          }`}
        >
          {vendor.vendor_status}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <div className="text-xs text-ink-muted">Credit limit</div>
            {editingLimit ? (
              <form action={handleLimitSubmit} className="flex items-center gap-2">
                <input
                  name="creditLimit"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={vendor.credit_limit_pesewas / 100}
                  className="w-24 rounded-md border border-brand-sage px-2 py-1 text-sm"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-brand-green px-2 py-1 text-xs text-white disabled:opacity-50"
                >
                  Save
                </button>
                <button type="button" onClick={() => setEditingLimit(false)} className="text-xs text-ink-muted">
                  Cancel
                </button>
              </form>
            ) : (
              <button
                onClick={() => setEditingLimit(true)}
                className="text-ink underline decoration-dotted underline-offset-4 hover:text-brand-green"
              >
                {vendor.credit_limit_pesewas === 0 ? 'Set limit' : formatGHS(vendor.credit_limit_pesewas)}
              </button>
            )}
          </div>
          <div>
            <div className="text-xs text-ink-muted">Outstanding</div>
            <div className="text-ink">{formatGHS(vendor.outstanding_balance_pesewas)}</div>
          </div>
          <div>
            <div className="text-xs text-ink-muted">Available credit</div>
            <div className="font-medium text-ink">{formatGHS(available)}</div>
          </div>
        </div>

        <div className="flex gap-3 text-xs">
          <Link href={`/admin/vendors/${vendor.id}`} className="text-ink hover:text-brand-green">
            Orders &amp; balance →
          </Link>
          {vendor.vendor_status !== 'approved' && (
            <button onClick={() => handleStatus('approved')} disabled={isPending} className="text-brand-green">
              Approve
            </button>
          )}
          {vendor.vendor_status !== 'frozen' && (
            <button onClick={() => handleStatus('frozen')} disabled={isPending} className="text-accent-terracotta">
              Freeze
            </button>
          )}
        </div>
      </div>
    </div>
  );
}