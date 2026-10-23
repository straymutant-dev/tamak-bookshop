// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState } from 'react';
import Link from 'next/link';
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
    <div id={`book-${book.id}`} className="featured-books__card featured-books__catalog-card">
      <Link href={`/store#book-${book.id}`} className="featured-books__catalog-link">
        <div className="featured-books__cover">
          <ImageWithSkeleton
            src={book.cover_image_url}
            alt={book.title}
            className="aspect-3/4 w-full rounded-sm"
          />
          <span className="featured-books__cover-arrow" aria-hidden="true">↗</span>
        </div>
        <p className="featured-books__category">
          {[book.subject, book.class_level].filter(Boolean).join(' · ') || book.category || 'School book'}
        </p>
        <p className="featured-books__title">{book.title}</p>
        <p className="featured-books__price">
          {formatGHS(displayPrice)}
          {isVendor && <span className="ml-1 text-xs font-normal text-ink-muted">(wholesale)</span>}
        </p>
      </Link>
      <button
        onClick={handleAdd}
        disabled={book.stock_quantity <= 0 || (isVendor && !vendorApproved)}
        className="featured-books__add-button"
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