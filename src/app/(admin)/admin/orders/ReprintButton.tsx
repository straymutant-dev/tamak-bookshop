// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState, useTransition } from 'react';
import Receipt, { type SaleResult } from '../pos/Receipt';
import { getReceiptForReprint } from '@/lib/actions/receipts';
import { useToast } from '@/components/ui/ToastContext';

export default function ReprintButton({ orderId }: { orderId: string }) {
  const [isPending, startTransition] = useTransition();
  const [receipt, setReceipt] = useState<{ sale: SaleResult; cashierName: string } | null>(null);
  const { showToast } = useToast();

  function handleReprint() {
    startTransition(async () => {
      try {
        const result = await getReceiptForReprint(orderId);
        setReceipt(result);
        setTimeout(() => window.print(), 100);
        showToast('Receipt reprinted');
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Failed to reprint', 'error');
      }
    });
  }

  return (
    <>
      <button
        onClick={handleReprint}
        disabled={isPending}
        className="text-sm font-medium text-brand-green hover:underline disabled:opacity-50"
      >
        {isPending ? 'Preparing…' : 'Reprint'}
      </button>
      {receipt && (
        <div className="hidden print:block">
          <Receipt sale={receipt.sale} cashierName={receipt.cashierName} />
        </div>
      )}
    </>
  );
}