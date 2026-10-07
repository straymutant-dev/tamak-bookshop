// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface CartItem {
  bookId: string;
  title: string;
  coverUrl: string | null;
  unitPricePesewas: number;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeItem: (bookId: string) => void;
  setQuantity: (bookId: string, quantity: number) => void;
  clear: () => void;
  totalPesewas: number;
  totalCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'tamak-cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // One-time client-only localStorage hydration; must happen after mount to avoid SSR/client mismatch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // corrupt or missing cart data — start fresh
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  function addItem(item: Omit<CartItem, 'quantity'>, quantity = 1) {
    setItems((prev) => {
      const existing = prev.find((i) => i.bookId === item.bookId);
      if (existing) {
        return prev.map((i) =>
          i.bookId === item.bookId ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { ...item, quantity }];
    });
  }

  function removeItem(bookId: string) {
    setItems((prev) => prev.filter((i) => i.bookId !== bookId));
  }

  function setQuantity(bookId: string, quantity: number) {
    if (quantity <= 0) return removeItem(bookId);
    setItems((prev) => prev.map((i) => (i.bookId === bookId ? { ...i, quantity } : i)));
  }

  function clear() {
    setItems([]);
  }

  const totalPesewas = items.reduce((sum, i) => sum + i.unitPricePesewas * i.quantity, 0);
  const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, setQuantity, clear, totalPesewas, totalCount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}