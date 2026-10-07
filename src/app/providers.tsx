// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { CartProvider } from '@/lib/cart/CartContext';
import { ToastProvider } from '@/components/ui/ToastContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <CartProvider>{children}</CartProvider>
    </ToastProvider>
  );
}