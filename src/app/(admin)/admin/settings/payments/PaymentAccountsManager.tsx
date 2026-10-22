// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState, useTransition } from 'react';
import { useToast } from '@/components/ui/ToastContext';
import { useConfirm } from '@/components/ui/ConfirmContext';
import {
  createPaymentAccount,
  deletePaymentAccount,
  setPaymentAccountActive,
  updatePaymentAccount,
} from './actions';

export interface AccountRow {
  id: string;
  kind: string;
  label: string;
  accountName: string;
  accountNumber: string;
  details: string | null;
  isActive: boolean;
}

const KIND_LABEL: Record<string, string> = { mobile_money: 'Mobile Money', bank_transfer: 'Bank transfer' };

export default function PaymentAccountsManager({ accounts }: { accounts: AccountRow[] }) {
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const editing = accounts.find((a) => a.id === editingId) ?? null;
  const fieldClass = 'rounded-md border border-brand-sage px-3 py-2 text-sm text-ink';

  function run(action: () => Promise<void>, message: string, after?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        showToast(message);
        after?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      }
    });
  }

  function handleSave(formData: FormData) {
    if (editingId === 'new') {
      run(() => createPaymentAccount(formData), 'Payment account added', () => setEditingId(null));
    } else if (editingId) {
      const id = editingId;
      run(() => updatePaymentAccount(id, formData), 'Payment account updated', () => setEditingId(null));
    }
  }

  async function handleDelete(a: AccountRow) {
    const ok = await confirm({
      title: `Delete "${a.label}"?`,
      message: 'Customers will no longer see this payment account.',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    run(() => deletePaymentAccount(a.id), 'Payment account deleted');
  }

  return (
    <div>
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mb-6 flex flex-col gap-3">
        {accounts.map((a) => (
          <div
            key={a.id}
            className={`flex flex-wrap items-start justify-between gap-3 rounded-md border border-border-beige bg-surface-card p-4 text-sm ${
              a.isActive ? '' : 'opacity-60'
            }`}
          >
            <div>
              <p className="text-xs text-ink-muted">
                {KIND_LABEL[a.kind] ?? a.kind} · {a.label}
                {!a.isActive && ' · hidden'}
              </p>
              <p className="font-medium text-ink">{a.accountName}</p>
              <p className="tracking-wide text-ink">{a.accountNumber}</p>
              {a.details && <p className="mt-1 text-xs text-ink-muted">{a.details}</p>}
            </div>
            <div className="flex gap-3 text-xs">
              <button onClick={() => setEditingId(a.id)} className="text-brand-green hover:underline">
                Edit
              </button>
              <button
                onClick={() =>
                  run(
                    () => setPaymentAccountActive(a.id, !a.isActive),
                    a.isActive ? 'Hidden from customers' : 'Shown to customers'
                  )
                }
                disabled={isPending}
                className="text-ink hover:underline disabled:opacity-50"
              >
                {a.isActive ? 'Hide' : 'Show'}
              </button>
              <button
                onClick={() => handleDelete(a)}
                disabled={isPending}
                className="text-accent-terracotta hover:underline disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {accounts.length === 0 && (
          <p className="rounded-md border border-border-beige bg-surface-card px-4 py-8 text-center text-sm text-ink-muted">
            No payment accounts yet. Add your Mobile Money number and bank account so customers know where to pay.
          </p>
        )}
      </div>

      {editingId === null ? (
        <button
          onClick={() => setEditingId('new')}
          className="rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white"
        >
          Add payment account
        </button>
      ) : (
        <form
          key={editingId}
          action={handleSave}
          className="grid max-w-xl gap-3 rounded-md border border-border-beige bg-surface-card p-5"
        >
          <h2 className="text-sm font-medium text-ink-muted">
            {editingId === 'new' ? 'New payment account' : 'Edit payment account'}
          </h2>

          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Type
            <select name="kind" defaultValue={editing?.kind ?? 'mobile_money'} className={fieldClass}>
              <option value="mobile_money">Mobile Money</option>
              <option value="bank_transfer">Bank transfer</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Label (what customers see)
            <input
              name="label"
              required
              defaultValue={editing?.label ?? ''}
              placeholder="MTN Mobile Money"
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Name on the account
            <input name="accountName" required defaultValue={editing?.accountName ?? ''} className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Account number or MoMo number
            <input name="accountNumber" required defaultValue={editing?.accountNumber ?? ''} className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Extra details (optional): bank branch, network, anything customers should know
            <input name="details" defaultValue={editing?.details ?? ''} className={fieldClass} />
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="rounded-md border border-brand-sage px-4 py-2 text-sm text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}