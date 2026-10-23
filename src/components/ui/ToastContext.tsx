// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { createContext, Suspense, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

interface ToastContextValue {
  showToast: (message: string, type?: 'success' | 'error') => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function ToastQueryListener({ showToast }: { showToast: ToastContextValue['showToast'] }) {
const searchParams = useSearchParams();
const router = useRouter();
const pathname = usePathname();
const shown = useRef<string | null>(null);

useEffect(() => {
  const message = searchParams.get('toast');
  if (!message || shown.current === message) return;
  shown.current = message;

  showToast(message);   // whatever your existing toast call is

  const params = new URLSearchParams(searchParams.toString());
  params.delete('toast');
  const query = params.toString();
  router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
}, [searchParams, router, pathname]);

  return null;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      <Suspense fallback={null}>
        <ToastQueryListener showToast={showToast} />
      </Suspense>

      {children}

      <div className="fixed right-4 top-4 z-70 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`glass-toast rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
              toast.type === 'error' ? 'bg-accent-terracotta' : 'bg-brand-green'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}