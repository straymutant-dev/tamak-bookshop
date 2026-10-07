// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState } from 'react';
import type { Book } from '@/lib/types';
import { formatGHS } from '@/lib/currency';
import { useCart } from '@/lib/cart/CartContext';
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton';

export default function BookCard({
  book,
  isVendor = false,
  vendorApproved = true,
}: {
  book: Book;
  isVendor?: boolean;
  vendorApproved?: boolean;
}) {

  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const displayPrice = isVendor && book.vendor_price_pesewas ? book.vendor_price_pesewas : book.customer_price_pesewas;

  function handleAdd() {
    addItem({
      bookId: book.id,
      title: book.title,
      coverUrl: book.cover_image_url,
      unitPricePesewas: displayPrice,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="border-b border-border-beige pb-4">
      <ImageWithSkeleton
        src={book.cover_image_url}
        alt={book.title}
        className="mb-3 aspect-3/4 w-full rounded-sm"
      />
      
      <p className="text-sm font-medium text-ink">{book.title}</p>
      <p className="mt-1 text-xs text-ink-muted">
        {[book.subject, book.class_level].filter(Boolean).join(' · ') || book.category || '—'}
      </p>
            <p className="mt-1 text-sm text-ink">
              {formatGHS(displayPrice)}
              {isVendor && <span className="ml-1 text-xs text-ink-muted">(wholesale)</span>}
            </p>

      <button
        onClick={handleAdd}
        disabled={book.stock_quantity <= 0 || (isVendor && !vendorApproved)}
        className="mt-2 w-full rounded-md border border-brand-sage py-1.5 text-xs font-medium text-ink hover:border-brand-green hover:text-brand-green disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isVendor && !vendorApproved
          ? 'Awaiting approval'
          : book.stock_quantity <= 0
            ? 'Out of stock'
            : added
              ? 'Added'
              : 'Add to cart'}
      </button>
    </div>
  );
}