'use client';

import { useState } from 'react';
import type { PaymentAccount } from '@/lib/paymentTypes';

export default function PaymentAccountList({ accounts }: { accounts: PaymentAccount[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState<string | null>(null);

  async function copy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setCopyFailed(null);
      window.setTimeout(() => setCopied((current) => (current === id ? null : current)), 1500);
    } catch {
      setCopyFailed(id);
    }
  }

  if (accounts.length === 0) {
    return (
      <p className="mt-2 text-xs text-ink-muted">
        The shop&rsquo;s payment details for this method aren&rsquo;t set up yet. Please contact the shop for where to pay.
      </p>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      {accounts.map((account) => (
        <div key={account.id} className="rounded-md bg-surface-card p-3">
          <p className="text-xs text-ink-muted">{account.label}</p>
          <p className="text-sm font-medium text-ink">{account.accountName}</p>
          <div className="flex items-center gap-3">
            <p className="text-base font-semibold tracking-wide text-ink">{account.accountNumber}</p>
            <button
              type="button"
              onClick={() => void copy(account.accountNumber, account.id)}
              className="text-xs text-brand-green hover:underline"
            >
              {copied === account.id ? 'Copied' : copyFailed === account.id ? 'Copy failed' : 'Copy'}
            </button>
          </div>
          {copyFailed === account.id && (
            <p className="mt-1 text-xs text-accent-terracotta">Copy failed. Please select and copy the number manually.</p>
          )}
          {account.details && <p className="mt-1 text-xs text-ink-muted">{account.details}</p>}
        </div>
      ))}
    </div>
  );
}
