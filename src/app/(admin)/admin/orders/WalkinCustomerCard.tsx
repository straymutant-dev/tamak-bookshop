// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState, useTransition } from 'react';
import { formatGHS } from '@/lib/currency';
import { useToast } from '@/components/ui/ToastContext';
import OrderNumberButton from '@/components/orders/OrderNumberButton';
import { bounceWalkinCheque, clearWalkinCheque, markWalkinNotified, receiveWalkinCheque } from './walkinActions';

export interface WalkinCustomer {
  name: string;
  phone: string;
  owedPesewas: number;
  openOrders: { id: string; orderNumber: string; createdAt: string; totalPesewas: number }[];
  pendingCheques: { number: string; totalPesewas: number; orderNumbers: string[] }[];
  clearedCheques: { number: string; totalPesewas: number }[];
}

export default function WalkinCustomerCard({ customer }: { customer: WalkinCustomer }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(customer.openOrders.map((o) => o.id)));
  const [chequeNumber, setChequeNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const selectedTotal = customer.openOrders
    .filter((o) => selected.has(o.id))
    .reduce((sum, o) => sum + o.totalPesewas, 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

  function handleBounce(number: string) {
    const note = window.prompt('Why did the cheque bounce? (optional)', '');
    if (note === null) return;
    run(() => bounceWalkinCheque(customer.phone, number, note), 'Cheque marked as bounced — the debt is open again');
  }

  return (
    <div className="rounded-md border border-border-beige bg-surface-card p-5 text-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-ink">{customer.name}</p>
          <p className="mt-1 text-xs text-ink">
            Phone:{' '}
            <a href={`tel:${customer.phone}`} className="text-brand-green hover:underline">
              {customer.phone}
            </a>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-ink-muted">Owes</p>
          <p className={`font-medium ${customer.owedPesewas > 0 ? 'text-accent-terracotta' : 'text-ink'}`}>
            {formatGHS(customer.owedPesewas)}
          </p>
        </div>
      </div>

      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      {customer.clearedCheques.map((c) => (
        <div key={c.number} className="mb-4 rounded-md bg-brand-green/10 p-3">
          <p className="text-xs font-medium text-brand-green">
            Cheque {c.number} has cleared — {formatGHS(c.totalPesewas)} paid
          </p>
          <p className="mt-1 text-xs text-ink">
            Let {customer.name} know: call{' '}
            <a href={`tel:${customer.phone}`} className="text-brand-green hover:underline">
              {customer.phone}
            </a>
            .
          </p>
          <button
            onClick={() => run(() => markWalkinNotified(customer.phone, c.number), 'Marked as told')}
            disabled={isPending}
            className="mt-2 rounded-md bg-brand-green px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            I&rsquo;ve told them
          </button>
        </div>
      ))}

      {customer.pendingCheques.map((c) => (
        <div key={c.number} className="mb-4 rounded-md bg-accent-gold/10 p-3">
          <p className="text-xs font-medium text-accent-gold">
            Cheque {c.number} — {formatGHS(c.totalPesewas)} — waiting to clear
          </p>
          <p className="mt-1 text-xs text-ink-muted">Orders: {c.orderNumbers.join(', ')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={() => run(() => clearWalkinCheque(customer.phone, c.number), 'Cheque cleared — orders marked paid')}
              disabled={isPending}
              className="rounded-md bg-brand-green px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              Cheque cleared
            </button>
            <button
              onClick={() => handleBounce(c.number)}
              disabled={isPending}
              className="rounded-md border border-accent-terracotta px-3 py-1.5 text-xs text-accent-terracotta disabled:opacity-50"
            >
              Bounced
            </button>
          </div>
        </div>
      ))}

      {customer.openOrders.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-ink-muted">Unpaid orders</p>
          <div className="mb-3 flex flex-col gap-1">
            {customer.openOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 text-xs text-ink">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
                  <OrderNumberButton orderId={o.id} orderNumber={o.orderNumber} />
                  <span className="text-ink-muted">{new Date(o.createdAt).toLocaleDateString()}</span>
                </span>
                <span>{formatGHS(o.totalPesewas)}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              Cheque number
              <input
                value={chequeNumber}
                onChange={(e) => setChequeNumber(e.target.value)}
                className="w-40 rounded-md border border-brand-sage px-3 py-2 text-sm text-ink"
              />
            </label>
            <button
              onClick={() =>
                run(
                  () => receiveWalkinCheque(Array.from(selected), chequeNumber),
                  'Cheque recorded — waiting to clear',
                  () => setChequeNumber('')
                )
              }
              disabled={isPending || selected.size === 0 || !chequeNumber.trim()}
              className="rounded-md bg-brand-green px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              Record cheque for {formatGHS(selectedTotal)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}