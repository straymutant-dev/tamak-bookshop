// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState, useTransition } from 'react';
import { formatGHS } from '@/lib/currency';
import { approveVendorOrder, rejectVendorOrder } from './actions';
import { useToast } from '@/components/ui/ToastContext';

interface OrderItem {
  quantity: number;
  unit_price_pesewas: number;
  books: { title: string } | { title: string }[] | null;
}

interface OrderRow {
  id: string;
  order_number: string;
  total_pesewas: number;
  created_at: string;
  order_items: OrderItem[];
}

function bookTitle(books: OrderItem['books']) {
  const book = Array.isArray(books) ? books[0] : books;
  return book?.title ?? 'Unknown title';
}

export default function ApprovalRow({
  order,
  vendorName,
  vendorAvailableCredit,
}: {
  order: OrderRow;
  vendorName: string;
  vendorAvailableCredit: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  const { showToast } = useToast();

  const overLimit = order.total_pesewas > vendorAvailableCredit;

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      try {
        await approveVendorOrder(order.id);
        showToast('Order approved');
        setResolved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to approve');
      }
    });
  }

  function handleReject() {
    setError(null);
    startTransition(async () => {
      try {
        await rejectVendorOrder(order.id);
        showToast('Order rejected');
        setResolved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to reject');
      }
    });
  }

  if (resolved) return null;

  return (
    <div className="rounded-md border border-border-beige bg-surface-card p-4 text-sm">
      <div className="mb-2 flex justify-between">
        <div>
          <p className="font-medium text-ink">
            {order.order_number} · {vendorName}
          </p>
          <p className="text-xs text-ink-muted">{new Date(order.created_at).toLocaleString()}</p>
        </div>
        <span className="font-medium text-ink">{formatGHS(order.total_pesewas)}</span>
      </div>

      <ul className="mb-3 text-xs text-ink-muted">
        {order.order_items.map((item, i) => (
          <li key={i}>
            {item.quantity} × {bookTitle(item.books)}
          </li>
        ))}
      </ul>

      {overLimit && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          This exceeds the vendor&rsquo;s available credit ({formatGHS(vendorAvailableCredit)}).
          Approving anyway will push their balance over the limit.
        </p>
      )}

      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          disabled={isPending}
          className="rounded-md bg-brand-green px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={handleReject}
          disabled={isPending}
          className="rounded-md border border-accent-terracotta px-4 py-2 text-xs text-accent-terracotta disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}