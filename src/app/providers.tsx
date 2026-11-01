// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { CartProvider } from '@/lib/cart/CartContext';
import { ToastProvider } from '@/components/ui/ToastContext';
import { ConfirmProvider } from '@/components/ui/ConfirmContext';
import RouteProgress from '@/components/ui/RouteProgress';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <CartProvider>
          <RouteProgress />
          {children}
        </CartProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}