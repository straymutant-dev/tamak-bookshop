// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { CartProvider } from '@/lib/cart/CartContext';
import { ToastProvider } from '@/components/ui/ToastContext';
import { ConfirmProvider } from '@/components/ui/ConfirmContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <CartProvider>{children}</CartProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}