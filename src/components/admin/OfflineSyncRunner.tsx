// STRAYMUTANT.DEV — Tamak Bookshop
// Path: src/components/admin/OfflineSyncRunner.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { syncOutbox } from '@/lib/offline/sync';
import { useOnline, useUnsentSalesCount } from '@/lib/offline/hooks';

/**
 * Sits in the admin header, so it runs on every admin page:
 *  - sends counter sales that are still saved on this device (when the internet is back), and
 *  - shows a bar while any are unsent, so nobody forgets about them.
 * The Counter sale page has its own, richer status line and sender, so this stays quiet there.
 */
export default function OfflineSyncRunner() {
  const pathname = usePathname();
  const online = useOnline();
  const unsent = useUnsentSalesCount();
  const [sending, setSending] = useState(false);
  const onCounterPage = pathname?.endsWith('/pos') ?? false;

  const send = useCallback(async () => {
    setSending(true);
    try {
      await syncOutbox();
    } finally {
      setSending(false);
    }
  }, []);

  useEffect(() => {
    if (onCounterPage) return;
    void send();
    const onOnline = () => void send();
    window.addEventListener('online', onOnline);
    const timer = setInterval(() => void send(), 30_000);
    return () => {
      window.removeEventListener('online', onOnline);
      clearInterval(timer);
    };
  }, [send, onCounterPage]);

  if (unsent === 0 || onCounterPage) return null;

  return (
    <div className="border-t border-amber-200 bg-amber-50 px-6 py-2 text-xs text-amber-900">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          {unsent} counter {unsent === 1 ? 'sale is' : 'sales are'} saved on this device and not sent to the shop system yet.
          {!online && ' The internet is off; they will be sent when it is back.'}
        </span>
        <button
          onClick={() => void send()}
          disabled={!online || sending}
          className="font-medium text-brand-green disabled:text-ink-muted"
        >
          {sending ? 'Sending…' : 'Send now'}
        </button>
      </div>
    </div>
  );
}