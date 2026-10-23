// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useMemo, useState, useTransition } from 'react';
import { formatGHS } from '@/lib/currency';
import { normalizeGhanaPhone } from '@/lib/phone';
import { useToast } from '@/components/ui/ToastContext';
import { logReceiptPrint } from '@/lib/actions/receipts';
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton';
import Receipt, { type SaleResult } from '../Receipt';
import { submitVendorPosSale } from './actions';

interface Book {
  id: string;
  title: string;
  author: string | null;
  subject: string | null;
  class_level: string | null;
  vendor_price_pesewas: number;
  stock_quantity: number;
  cover_image_url: string | null;
}

interface VendorAccount {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  limitPesewas: number;
  owedPesewas: number;
  reservedPesewas: number;
}

interface CartLine {
  bookId: string;
  title: string;
  unitPricePesewas: number;
  quantity: number;
  maxStock: number;
}

type Method = 'credit' | 'cash' | 'mobile_money' | 'bank_transfer';

const METHOD_LABEL: Record<Method, string> = {
  credit: 'On credit (pays later)',
  cash: 'Cash',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Bank transfer',
};

export default function VendorPosTerminal({
  books,
  vendors,
  cashierName,
}: {
  books: Book[];
  vendors: VendorAccount[];
  cashierName: string;
}) {
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerType, setCustomerType] = useState<'account' | 'walkin'>('account');
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [walkinName, setWalkinName] = useState('');
  const [walkinPhone, setWalkinPhone] = useState('');
  const [method, setMethod] = useState<Method>('credit');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<SaleResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const vendor = vendors.find((v) => v.id === vendorId) ?? null;
  const availableCredit = vendor ? Math.max(0, vendor.limitPesewas - vendor.owedPesewas - vendor.reservedPesewas) : 0;

  const filteredVendors = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    if (!q) return vendors.slice(0, 8);
    return vendors
      .filter(
        (v) => v.name.toLowerCase().includes(q) || v.contactName.toLowerCase().includes(q) || v.phone.includes(q)
      )
      .slice(0, 8);
  }, [vendorSearch, vendors]);

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

  const totalPesewas = cart.reduce((sum, l) => sum + l.unitPricePesewas * l.quantity, 0);

  const methods: Method[] = ['credit', 'cash', 'mobile_money', 'bank_transfer'];
  const needsRef = method === 'mobile_money' || method === 'bank_transfer';
  const walkinPhoneOk = !!normalizeGhanaPhone(walkinPhone);
  const overCredit = method === 'credit' && vendor !== null && totalPesewas > availableCredit;

  const customerReady =
    customerType === 'account' ? vendor !== null : walkinName.trim().length > 0 && walkinPhoneOk;
  const canComplete = cart.length > 0 && customerReady && !(needsRef && !reference.trim()) && !overCredit;

  function chooseCustomerType(type: 'account' | 'walkin') {
    setCustomerType(type);
    setError(null);
    if (type === 'walkin') setVendorId(null);
    setMethod('credit');
  }

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
          unitPricePesewas: book.vendor_price_pesewas,
          quantity: 1,
          maxStock: book.stock_quantity,
        },
      ];
    });
  }

  function setQuantity(bookId: string, quantity: number) {
    setCart((prev) =>
      prev.map((l) => (l.bookId === bookId ? { ...l, quantity: Math.min(Math.max(1, quantity), l.maxStock) } : l))
    );
  }

  function removeLine(bookId: string) {
    setCart((prev) => prev.filter((l) => l.bookId !== bookId));
  }

  function handleSubmit() {
    setError(null);
    const formData = new FormData();
    if (customerType === 'account' && vendor) formData.set('vendorId', vendor.id);
    formData.set('walkinName', walkinName);
    formData.set('walkinPhone', walkinPhone);
    formData.set('paymentMethod', method);
    formData.set('paymentReference', reference);
    formData.set('items', JSON.stringify(cart.map((l) => ({ bookId: l.bookId, quantity: l.quantity }))));

    startTransition(async () => {
      try {
        const result = await submitVendorPosSale(formData);
        setCompletedSale(result);
        showToast(result.isCredit ? 'Sale billed to credit account' : 'Sale completed');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      }
    });
  }

  function startNewSale() {
    setCompletedSale(null);
    setCart([]);
    setVendorId(null);
    setVendorSearch('');
    setWalkinName('');
    setWalkinPhone('');
    setCustomerType('account');
    setMethod('credit');
    setReference('');
    setSearch('');
    setError(null);
  }

  if (completedSale) {
    return (
      <div className="mx-auto max-w-sm">
        <div className="mb-6 rounded-md border border-border-beige bg-surface-card p-6 text-center">
          <h2 className="mb-2 font-serif text-xl text-ink">
            {completedSale.isCredit ? 'Billed to credit account' : 'Sale complete'}
          </h2>
          <p className="mb-1 text-sm text-ink-muted">
            Order <span className="font-medium text-ink">{completedSale.orderNumber}</span> —{' '}
            {formatGHS(completedSale.totalPesewas)}
          </p>
          {completedSale.isCredit && completedSale.balanceOwedPesewas != null && (
            <p className="mb-1 text-sm text-accent-terracotta">
              {completedSale.customerName} now owes {formatGHS(completedSale.balanceOwedPesewas)}
            </p>
          )}
          <div className="mt-6 flex justify-center gap-3">
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
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
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
              className="featured-books__card featured-books__pos-card"
              aria-label={`Add ${book.title} to the current sale`}
            >
              <div className="featured-books__cover">
                <ImageWithSkeleton
                  src={book.cover_image_url}
                  alt=""
                  className="aspect-3/4 w-full rounded-sm"
                />
                <span className="featured-books__cover-arrow" aria-hidden="true">+</span>
              </div>
              <p className="featured-books__category">
                {[book.subject, book.class_level].filter(Boolean).join(' · ') || 'School book'}
              </p>
              <p className="featured-books__title">{book.title}</p>
              <div className="featured-books__pos-details">
                <p className="featured-books__price">
                  {formatGHS(book.vendor_price_pesewas)}
                  <span className="featured-books__pos-wholesale">Wholesale</span>
                </p>
                <p className="featured-books__pos-stock">Stock: {book.stock_quantity}</p>
              </div>
            </button>
          ))}
          {filteredBooks.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-ink-muted">No matching books in stock.</p>
          )}
        </div>
      </div>

      <div className="rounded-md border border-border-beige bg-surface-card p-5">
        <h2 className="mb-4 text-sm font-medium text-ink-muted">Vendor</h2>

        <div className="mb-4 flex gap-4 text-sm">
          <label className="flex items-center gap-2 text-ink">
            <input type="radio" checked={customerType === 'account'} onChange={() => chooseCustomerType('account')} />
            Has an account
          </label>
          <label className="flex items-center gap-2 text-ink">
            <input type="radio" checked={customerType === 'walkin'} onChange={() => chooseCustomerType('walkin')} />
            Walk-in (no account)
          </label>
        </div>

        {customerType === 'account' ? (
          <div className="mb-4">
            {vendor ? (
              <div className="rounded-md bg-surface-cream p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink">{vendor.name}</p>
                    {vendor.phone && <p className="text-xs text-ink-muted">{vendor.phone}</p>}
                  </div>
                  <button onClick={() => setVendorId(null)} className="text-xs text-brand-green hover:underline">
                    Change
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-ink-muted">Limit</p>
                    <p className="text-ink">{formatGHS(vendor.limitPesewas)}</p>
                  </div>
                  <div>
                    <p className="text-ink-muted">Owes</p>
                    <p className="text-ink">{formatGHS(vendor.owedPesewas)}</p>
                  </div>
                  <div>
                    <p className="text-ink-muted">Available</p>
                    <p className="font-medium text-brand-green">{formatGHS(availableCredit)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <input
                  value={vendorSearch}
                  onChange={(e) => setVendorSearch(e.target.value)}
                  placeholder="Search vendor by name or phone…"
                  className="mb-2 w-full rounded-md border border-brand-sage px-3 py-2 text-sm"
                />
                <div className="flex flex-col overflow-hidden rounded-md border border-border-beige">
                  {filteredVendors.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setVendorId(v.id)}
                      className="border-b border-border-beige px-3 py-2 text-left text-sm last:border-b-0 hover:bg-surface-cream"
                    >
                      <span className="text-ink">{v.name}</span>
                      {v.phone && <span className="ml-2 text-xs text-ink-muted">{v.phone}</span>}
                    </button>
                  ))}
                  {filteredVendors.length === 0 && (
                    <p className="px-3 py-3 text-xs text-ink-muted">No approved vendor found. Try a walk-in sale.</p>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="mb-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Vendor / business name
              <input
                value={walkinName}
                onChange={(e) => setWalkinName(e.target.value)}
                className="rounded-md border border-brand-sage px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Phone number
              <input
                type="tel"
                value={walkinPhone}
                onChange={(e) => setWalkinPhone(e.target.value)}
                placeholder="024 123 4567"
                className="rounded-md border border-brand-sage px-3 py-2 text-sm"
              />
              {walkinPhone && !walkinPhoneOk && <span className="text-xs text-red-700">Enter a valid Ghana number</span>}
            </label>
            <p className="text-xs text-ink-muted">
              Walk-ins can take books on credit too. There is no credit limit for them, so check you are happy with
              what they already owe (Orders → Walk-in credit). They bring a cheque later.
            </p>
          </div>
        )}

        <h2 className="mb-3 border-t border-border-beige pt-4 text-sm font-medium text-ink-muted">Current sale</h2>

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

        <div className="mb-3 flex flex-col gap-1 text-sm">
          Payment
          {methods.map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" checked={method === m} onChange={() => setMethod(m)} />
              {METHOD_LABEL[m]}
            </label>
          ))}
        </div>

        {method === 'credit' && customerType === 'walkin' && (
          <p className="mb-3 text-xs text-ink-muted">
            This goes on their tab, tracked by phone number under Orders → Walk-in credit.
          </p>
        )}
        {method === 'credit' && vendor && (
          <p className={`mb-3 text-xs ${overCredit ? 'text-red-700' : 'text-ink-muted'}`}>
            {overCredit
              ? `This is ${formatGHS(totalPesewas - availableCredit)} over their available credit. Reduce the order, raise their limit on the vendor page, or take payment.`
              : `They will owe ${formatGHS(vendor.owedPesewas + totalPesewas)} after this sale.`}
          </p>
        )}
        <p className="mb-3 text-xs text-ink-muted">
          Cheque? Put the sale on credit now. Record the cheque when they bring it
          {customerType === 'account' ? ' under Repayments' : ' under Orders → Walk-in credit'}.
        </p>

        {needsRef && (
          <label className="mb-3 flex flex-col gap-1 text-sm">
            Reference / transaction ID
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="rounded-md border border-brand-sage px-3 py-2 text-sm"
            />
          </label>
        )}

        <button
          onClick={handleSubmit}
          disabled={isPending || !canComplete}
          className="w-full rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? 'Completing sale…' : method === 'credit' ? 'Bill to credit account' : 'Complete sale'}
        </button>
      </div>
    </div>
  );
}