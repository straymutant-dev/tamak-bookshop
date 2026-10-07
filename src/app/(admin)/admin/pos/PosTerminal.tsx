// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useMemo, useState, useTransition } from 'react';
import { formatGHS } from '@/lib/currency';
import { useToast } from '@/components/ui/ToastContext';
import { submitPosSale } from './actions';
import { logReceiptPrint } from '@/lib/actions/receipts';
import Receipt, { type SaleResult } from './Receipt';
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton';

interface Book {
  id: string;
  title: string;
  author: string | null;
  category: string | null;
  subject: string | null;
  class_level: string | null;
  customer_price_pesewas: number;
  stock_quantity: number;
  cover_image_url: string | null;
}

interface CartLine {
  bookId: string;
  title: string;
  unitPricePesewas: number;
  quantity: number;
  maxStock: number;
}

const PAY_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'bank_transfer', label: 'Bank transfer' },
];

export default function PosTerminal({ books, cashierName }: { books: Book[]; cashierName: string }) {
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<SaleResult | null>(null);
  const { showToast } = useToast();

  const filteredBooks = useMemo(() => {
    if (!search.trim()) return books.slice(0, 20);
    const q = search.toLowerCase();
    return books
      .filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author?.toLowerCase().includes(q) ||
          b.class_level?.toLowerCase().includes(q) ||
          b.subject?.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [search, books]);

  const totalPesewas = cart.reduce((sum, line) => sum + line.unitPricePesewas * line.quantity, 0);

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

  function handleSubmit() {
    setError(null);
    const formData = new FormData();
    formData.set('customerName', customerName);
    formData.set('paymentMethod', paymentMethod);
    formData.set('paymentReference', paymentReference);
    formData.set(
      'items',
      JSON.stringify(cart.map((l) => ({ bookId: l.bookId, title: l.title, quantity: l.quantity })))
    );

    startTransition(async () => {
      try {
        const result = await submitPosSale(formData);
        setCompletedSale(result);
        showToast('Sale completed');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      }
    });
  }

  function startNewSale() {
    setCompletedSale(null);
    setCart([]);
    setCustomerName('');
    setPaymentMethod('cash');
    setPaymentReference('');
    setSearch('');
  }

  if (completedSale) {
    return (
      <div className="mx-auto max-w-sm">
        <div className="mb-6 rounded-md border border-border-beige bg-surface-card p-6 text-center">
          <h2 className="mb-2 font-serif text-xl text-ink">Sale complete</h2>
          <p className="mb-6 text-sm text-ink-muted">
            Order <span className="font-medium text-ink">{completedSale.orderNumber}</span> —{' '}
            {formatGHS(completedSale.totalPesewas)}
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={async () => {
                try {
                  await logReceiptPrint(completedSale.orderId);
                } catch (e) {
                  console.error('Failed to log receipt print:', e);
                }
                window.print();
              }}
              className="rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white"
            >
              Print receipt
            </button>            <button
              onClick={async () => {
                try {
                  await logReceiptPrint(completedSale.orderId);
                } catch (e) {
                  console.error('Failed to log receipt print:', e);
                }
                window.print();
              }}
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
          <Receipt sale={completedSale} cashierName={cashierName} />
        </div>
      </div>
    );
  }

  return (
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
              className="mb-2 aspect-3/4 w-full rounded-sm" />
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
              <input
                type="radio"
                checked={paymentMethod === m.value}
                onChange={() => setPaymentMethod(m.value)}
              />
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
          onClick={handleSubmit}
          disabled={isPending || cart.length === 0}
          className="w-full rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? 'Completing sale…' : 'Complete sale'}
        </button>
      </div>
    </div>
  );
}