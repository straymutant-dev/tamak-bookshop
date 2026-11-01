// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState, useTransition } from 'react';
import ProcessingButton from '@/components/ui/ProcessingButton';
import { useToast } from '@/components/ui/ToastContext';
import { useConfirm } from '@/components/ui/ConfirmContext';
import { resetLaunchProject } from './resetActions';

export default function ResetProjectPanel() {
  const [confirmation, setConfirmation] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();
  const confirm = useConfirm();

  async function handleReset() {
    if (confirmation !== 'RESET PROJECT') {
      setError('Type RESET PROJECT exactly to continue');
      return;
    }

    const ok = await confirm({
      title: 'Permanently reset the project?',
      message: 'This removes books, sales, orders, repayments, returns, shifts, notifications, audit history, cover images, and every account except the super admin. This cannot be undone.',
      confirmLabel: 'Reset project',
      tone: 'danger',
    });
    if (!ok) return;

    setError(null);
    const formData = new FormData();
    formData.set('confirmation', confirmation);
    startTransition(async () => {
      try {
        await resetLaunchProject(formData);
        setConfirmation('');
        showToast('Project data reset successfully');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Reset failed');
      }
    });
  }

  return (
    <section className="mt-10 rounded-md border border-red-200 bg-surface-card p-6">
      <div className="max-w-2xl">
        <h2 className="text-lg font-semibold text-red-700">Launch reset</h2>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          Permanently deletes test products, cover images, orders and sales records, vendor/client/staff accounts,
          repayments, returns, cashier shifts, notifications, login history and audit history.
          The super-admin account and payment-account configuration are preserved.
        </p>
      </div>

      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-5 flex max-w-lg flex-col gap-3 sm:flex-row">
        <input
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder="Type RESET PROJECT"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-md border border-red-300 px-3 py-2 text-sm"
        />
        <ProcessingButton
          type="button"
          onClick={handleReset}
          isProcessing={isPending}
          processingText="Resetting…"
          disabled={confirmation !== 'RESET PROJECT' || isPending}
          className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset project
        </ProcessingButton>
      </div>
    </section>
  );
}
