// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastContext';
import { setVendorCreditLimit } from '../actions';

export default function VendorLimitForm({
  vendorId,
  currentLimitPesewas,
}: {
  vendorId: string;
  currentLimitPesewas: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { showToast } = useToast();

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set('vendorId', vendorId);
    startTransition(async () => {
      try {
        await setVendorCreditLimit(formData);
        showToast('Credit limit updated');
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update credit limit');
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        Credit limit (GHS)
        <input
          name="creditLimit"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={currentLimitPesewas / 100}
          className="w-40 rounded-md border border-brand-sage px-3 py-2 text-sm text-ink"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Save limit'}
      </button>
      {error && <p className="w-full text-xs text-red-700">{error}</p>}
    </form>
  );
}