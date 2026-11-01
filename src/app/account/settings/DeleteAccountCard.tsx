// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState, useTransition } from 'react';
import ProcessingButton from '@/components/ui/ProcessingButton';
import { useConfirm } from '@/components/ui/ConfirmContext';
import { deleteOwnAccount } from './actions';

export default function DeleteAccountCard({
  role,
  outstandingPesewas = 0,
  pendingCreditOrders = 0,
}: {
  role: 'client' | 'vendor';
  outstandingPesewas?: number;
  pendingCreditOrders?: number;
}) {
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirm();
  const vendorBlocked = role === 'vendor' && (outstandingPesewas !== 0 || pendingCreditOrders > 0);

  async function handleDelete() {
    if (vendorBlocked) {
      setError('Vendor deletion is blocked while outstanding credit or pending credit orders remain');
      return;
    }
    if (confirmation !== 'DELETE ACCOUNT') {
      setError('Type DELETE ACCOUNT exactly to continue');
      return;
    }

    const approved = await confirm({
      title: 'Permanently delete your account?',
      message: 'This removes your sign-in and profile. Required financial/order records may be retained without your personal account details.',
      confirmLabel: 'Delete account',
      tone: 'danger',
    });
    if (!approved) return;

    setError(null);
    const formData = new FormData();
    formData.set('confirmation', confirmation);
    startTransition(async () => {
      try {
        await deleteOwnAccount(formData);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Account deletion failed');
      }
    });
  }

  return (
    <section className="rounded-md border border-red-200 bg-surface-card p-6 sm:col-span-2">
      <h2 className="mb-2 text-sm font-medium text-red-700">Delete account</h2>
      <p className="text-sm leading-6 text-ink-muted">
        {vendorBlocked
          ? 'Vendor account deletion is disabled until outstanding credit is paid and all pending credit orders are resolved. This cannot be bypassed.'
          : 'This permanently removes your sign-in and profile. This action cannot be undone.'}
      </p>

      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!vendorBlocked && (
        <div className="mt-4 flex max-w-lg flex-col gap-3 sm:flex-row">
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="Type DELETE ACCOUNT"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-md border border-red-300 px-3 py-2 text-sm"
          />
          <ProcessingButton
            type="button"
            onClick={handleDelete}
            isProcessing={isPending}
            processingText="Deleting…"
            disabled={confirmation !== 'DELETE ACCOUNT' || isPending}
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete account
          </ProcessingButton>
        </div>
      )}
    </section>
  );
}
