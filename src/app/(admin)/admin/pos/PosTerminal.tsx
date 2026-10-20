// STRAYMUTANT.DEV — Tamak Bookshop
// Path: src/app/(admin)/admin/pos/PosTerminal.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatGHS } from '@/lib/currency';
import { useToast } from '@/components/ui/ToastContext';
import { logReceiptPrint } from '@/lib/actions/receipts';
import Receipt, { type SaleResult } from './Receipt';
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton';
import {
  bumpPrintCount,
  cacheBooks,
  getCachedBooks,
  offlineDB,
  queueSale,
  type CachedBook,
  type OutboxSale,
} from '@/lib/offline/db';
import { syncOutbox } from '@/lib/offline/sync';
import { useOnline, useOutbox } from '@/lib/offline/hooks';

type Book = CachedBook;
type PayMethod = 'cash' | 'mobile_money' | 'bank_transfer';

interface CartLine {
  bookId: string;
  title: string;
  unitPricePesewas: number;
  quantity: number;
  maxStock: number;
}

const PAY_METHODS: { value: PayMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'bank_transfer', label: 'Bank transfer' },
];

function toSaleResult(r: OutboxSale): SaleResult {
  return {
    orderId: r.orderId ?? '',
    orderNumber: r.orderNumber,
    createdAt: r.soldAt,
    items: r.items.map((i) => ({
      title: i.title,
      quantity: i.quantity,
      unit_price_pesewas: i.unitPricePesewas,
      line_total_pesewas: i.unitPricePesewas * i.quantity,
    })),
    totalPesewas: r.totalPesewas,
    paymentMethod: r.paymentMethod,
    paymentReference: r.paymentReference,
    customerName: r.customerName,
  };
}

export default function PosTerminal({ books, cashierName }: { books: Book[]; cashierName: string }) {
  const router = useRouter();
  const online = useOnline();
  const outbox = useOutbox();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [completed, setCompleted] = useState<OutboxSale | null>(null);
  // A copy of the catalogue from this device, used when the page was opened without internet.
  const [cache, setCache] = useState<{ source: Book[]; list: Book[] } | null>(null);
  // When the catalogue on screen was loaded. Sales that reached the server after this are not in its stock numbers yet.
  const [snapshotAt, setSnapshotAt] = useState('');

  // ---- sync -------------------------------------------------------------
  const runSync = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await syncOutbox();
      if (result.synced > 0) router.refresh(); // fresh stock numbers from the server
    } finally {
      setSyncing(false);
    }
  }, [router]);

  useEffect(() => {
    void runSync();
    const onOnline = () => void runSync();
    window.addEventListener('online', onOnline);
    const timer = setInterval(() => void runSync(), 30_000);
    return () => {
      window.removeEventListener('online', onOnline);
      clearInterval(timer);
    };
  }, [runSync]);

  // ---- catalogue: save a copy for offline use, or read the saved copy when offline ----
  useEffect(() => {
    setSnapshotAt(new Date().toISOString());
    if (navigator.onLine) {
      cacheBooks(books).catch((e) => console.error('[offline] could not save the catalogue', e));
    } else {
      getCachedBooks()
        .then((list) => {
          if (list.length > 0) setCache({ source: books, list });
        })
        .catch((e) => console.error('[offline] could not read the saved catalogue', e));
    }
  }, [books]);

  // ---- service worker: lets this page open again with no internet ----
  useEffect(() => {
    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    }
  }, []);

  // Stock on screen = the catalogue's stock minus sales the catalogue doesn't know about yet.
  const base = cache && cache.source === books ? cache.list : books;
  const reserved = useMemo(() => {
    const map = new Map<string, number>();
    for (const sale of outbox) {
      if (sale.status === 'synced' && (!sale.syncedAt || sale.syncedAt <= snapshotAt)) continue;
      for (const item of sale.items) map.set(item.bookId, (map.get(item.bookId) ?? 0) + item.quantity);
    }
    return map;
  }, [outbox, snapshotAt]);

  const catalog = useMemo(
    () =>
      base
        .map((b) => ({ ...b, stock_quantity: Math.max(0, b.stock_quantity - (reserved.get(b.id) ?? 0)) }))
        .filter((b) => b.stock_quantity > 0),
    [base, reserved]
  );

  const filteredBooks = useMemo(() => {
    if (!search.trim()) return catalog.slice(0, 20);
    const q = search.toLowerCase();
    return catalog
      .filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author?.toLowerCase().includes(q) ||
          b.class_level?.toLowerCase().includes(q) ||
          b.subject?.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [search, catalog]);

  const waiting = outbox.filter((s) => s.status === 'pending' || s.status === 'syncing');
  const failed = outbox.filter((s) => s.status === 'failed');
  const totalPesewas = cart.reduce((sum, line) => sum + line.unitPricePesewas * line.quantity, 0);

  // ---- cart -------------------------------------------------------------
  function addToCart(book: Book) {
    setCart((prev) => {
      const existing = prev.find((l) => l.bookId === book.id);
      if (existing) {
        if (existing.quantity >= book.stock_quantity) return prev;
        return prev.map((l) => (l.bookId === book.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          bookId: book.id,
          title: book.title,
          unitPricePesewas: book.customer_price_pesewas,
          quantity: 1,
          maxStock: book.stock_quantity,
        },
      ];
    });
  }

  function setQuantity(bookId: string, quantity: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.bookId === bookId ? { ...l, quantity: Math.min(Math.max(1, quantity), l.maxStock) } : l))
        .filter((l) => l.quantity > 0)
    );
  }

  function removeLine(bookId: string) {
    setCart((prev) => prev.filter((l) => l.bookId !== bookId));
  }

  // ---- complete a sale: save on this device FIRST, then send ----
  async function handleSubmit() {
    if (cart.length === 0 || saving) return;
    setError(null);
    setSaving(true);
    try {
      const row = await queueSale({
        clientUuid: crypto.randomUUID(),
        orderNumber: `TB-POS-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
        soldAt: new Date().toISOString(),
        items: cart.map((l) => ({
          bookId: l.bookId,
          title: l.title,
          quantity: l.quantity,
          unitPricePesewas: l.unitPricePesewas,
        })),
        totalPesewas,
        paymentMethod,
        paymentReference: paymentReference.trim() || null,
        customerName: customerName.trim() || null,
        cashierName,
      });
      setCompleted(row);
      showToast(navigator.onLine ? 'Sale completed' : 'Sale saved on this device');
      void runSync();
    } catch (e) {
      console.error('[offline] could not save the sale', e);
      setError('Could not save the sale on this device. Check that the browser has free storage and try again.');
    } finally {
      setSaving(false);
    }
  }

  function startNewSale() {
    setCompleted(null);
    setCart([]);
    setCustomerName('');
    setPaymentMethod('cash');
    setPaymentReference('');
    setSearch('');
  }

  async function retryFailed() {
    await offlineDB.outbox.where('status').equals('failed').modify({ status: 'pending', lastError: null });
    void runSync();
  }

  async function printReceipt(row: OutboxSale) {
    if (row.orderId) {
      try {
        await logReceiptPrint(row.orderId);
      } catch (e) {
        console.error('Failed to log receipt print:', e);
      }
    } else {
      await bumpPrintCount(row.clientUuid); // logged once the sale reaches the server
    }
    window.print();
  }

  // ---- sale complete screen ----
  if (completed) {
    const row = outbox.find((s) => s.clientUuid === completed.clientUuid) ?? completed;
    const sale = toSaleResult(row);
    return (
      <div className="mx-auto max-w-sm">
        <div className="mb-6 rounded-md border border-border-beige bg-surface-card p-6 text-center">
          <h2 className="mb-2 font-serif text-xl text-ink">Sale complete</h2>
          <p className="mb-2 text-sm text-ink-muted">
            Order <span className="font-medium text-ink">{row.orderNumber}</span> — {formatGHS(row.totalPesewas)}
          </p>

          {row.status === 'synced' && <p className="mb-4 text-xs text-brand-green">Saved to the shop system.</p>}
          {(row.status === 'pending' || row.status === 'syncing') && (
            <p className="mb-4 text-xs text-amber-800">
              {online
                ? 'Saved on this device. Sending to the shop system…'
                : 'Saved on this device. It will be sent when the internet is back. You can print the receipt now.'}
            </p>
          )}
          {row.status === 'failed' && (
            <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              The shop system did not accept this sale: {row.lastError}. Tell an admin.
            </p>
          )}
          {row.warnings.length > 0 && (
            <ul className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-left text-xs text-amber-900">
              {row.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}

          <div className="flex justify-center gap-3">
            <button
              onClick={() => void printReceipt(row)}
              className="rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white"
            >
              Print receipt
            </button>
            <button onClick={startNewSale} className="rounded-md border border-brand-sage px-4 py-2 text-sm text-ink">
              New sale
            </button>
          </div>
        </div>

        {/* Hidden on screen, styled for #thermal-receipt @media print in globals.css */}
        <div className="hidden print:block">
          <Receipt sale={sale} cashierName={cashierName} />
        </div>
      </div>
    );
  }

  // ---- main screen ----
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs">
        <span
          className={`rounded-full px-3 py-1 font-medium ${
            online ? 'bg-brand-green/10 text-brand-green' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {online ? 'Online' : 'Offline — sales are saved on this device'}
        </span>
        {waiting.length > 0 && (
          <>
            <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-800">
              {waiting.length} {waiting.length === 1 ? 'sale' : 'sales'} waiting to send
            </span>
            <button
              onClick={() => void runSync()}
              disabled={!online || syncing}
              className="font-medium text-brand-green disabled:text-ink-muted"
            >
              {syncing ? 'Sending…' : 'Send now'}
            </button>
          </>
        )}
        {failed.length > 0 && (
          <span className="rounded-full bg-red-50 px-3 py-1 font-medium text-red-700">
            {failed.length} {failed.length === 1 ? 'sale needs' : 'sales need'} attention
          </span>
        )}
        {!online && <span className="text-ink-muted">Stock and prices are as of when this page last loaded.</span>}
      </div>

      {waiting.length + failed.length > 0 && (
        <details className="mb-4 rounded-md border border-border-beige bg-surface-card p-3 text-sm">
          <summary className="cursor-pointer font-medium text-ink">Sales saved on this device</summary>
          <ul className="mt-3 flex flex-col gap-2">
            {[...waiting, ...failed].map((s) => (
              <li key={s.clientUuid} className="flex items-start justify-between gap-3 text-xs">
                <div>
                  <p className="font-medium text-ink">
                    {s.orderNumber} · {formatGHS(s.totalPesewas)}
                  </p>
                  <p className="text-ink-muted">
                    {new Date(s.soldAt).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })} ·{' '}
                    {s.status === 'failed' ? `Not accepted: ${s.lastError}` : s.lastError ?? 'Waiting to send'}
                  </p>
                </div>
                <span className={s.status === 'failed' ? 'text-red-700' : 'text-amber-800'}>
                  {s.status === 'failed' ? 'Needs attention' : 'Waiting'}
                </span>
              </li>
            ))}
          </ul>
          {failed.length > 0 && (
            <button onClick={() => void retryFailed()} className="mt-3 text-xs font-medium text-brand-green">
              Try the failed sales again
            </button>
          )}
        </details>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, author, class level or subject…"
            className="mb-4 w-full rounded-md border border-brand-sage px-3 py-2 text-sm"
          />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filteredBooks.map((book) => (
              <button
                key={book.id}
                onClick={() => addToCart(book)}
                className="rounded-md border border-border-beige bg-surface-card p-3 text-left hover:border-brand-green"
              >
                <ImageWithSkeleton
                  src={book.cover_image_url}
                  alt={book.title}
                  className="mb-2 aspect-3/4 w-full rounded-sm"
                />
                <p className="line-clamp-2 text-xs font-medium text-ink">{book.title}</p>
                <p className="mt-1 text-xs text-ink-muted">{formatGHS(book.customer_price_pesewas)}</p>
                <p className="text-xs text-ink-muted">Stock: {book.stock_quantity}</p>
              </button>
            ))}
            {filteredBooks.length === 0 && (
              <p className="col-span-full py-8 text-center text-sm text-ink-muted">No matching books in stock.</p>
            )}
          </div>
        </div>

        <div className="rounded-md border border-border-beige bg-surface-card p-5">
          <h2 className="mb-4 text-sm font-medium text-ink-muted">Current sale</h2>

          {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

          <div className="mb-4 flex flex-col gap-3">
            {cart.map((line) => (
              <div key={line.bookId} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-ink">{line.title}</p>
                  <p className="text-xs text-ink-muted">{formatGHS(line.unitPricePesewas)} each</p>
                </div>
                <input
                  type="number"
                  min={1}
                  max={line.maxStock}
                  value={line.quantity}
                  onChange={(e) => setQuantity(line.bookId, Number(e.target.value))}
                  className="w-14 rounded-md border border-brand-sage px-2 py-1 text-xs"
                />
                <button onClick={() => removeLine(line.bookId)} className="text-xs text-accent-terracotta">
                  ✕
                </button>
              </div>
            ))}
            {cart.length === 0 && <p className="text-sm text-ink-muted">Tap a book to add it.</p>}
          </div>

          <div className="mb-4 flex justify-between border-t border-border-beige pt-3 text-sm font-medium">
            <span className="text-ink-muted">Total</span>
            <span className="text-ink">{formatGHS(totalPesewas)}</span>
          </div>

          <label className="mb-3 flex flex-col gap-1 text-sm">
            Customer name (optional)
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="rounded-md border border-brand-sage px-3 py-2 text-sm"
            />
          </label>

          <div className="mb-3 flex flex-col gap-1 text-sm">
            Payment method
            {PAY_METHODS.map((m) => (
              <label key={m.value} className="flex items-center gap-2 text-sm text-ink">
                <input type="radio" checked={paymentMethod === m.value} onChange={() => setPaymentMethod(m.value)} />
                {m.label}
              </label>
            ))}
          </div>

          {(paymentMethod === 'mobile_money' || paymentMethod === 'bank_transfer') && (
            <label className="mb-3 flex flex-col gap-1 text-sm">
              Reference number
              <input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="rounded-md border border-brand-sage px-3 py-2 text-sm"
              />
            </label>
          )}

          <button
            onClick={() => void handleSubmit()}
            disabled={saving || cart.length === 0}
            className="w-full rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Completing sale…' : 'Complete sale'}
          </button>
        </div>
      </div>
    </div>
  );
}