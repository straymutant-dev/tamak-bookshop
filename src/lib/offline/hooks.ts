// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { liveQuery } from 'dexie';
import { offlineDB, type OutboxSale } from './db';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** The browser's idea of "connected". (Wi-Fi with no internet can still say true; a failed sync handles that.) */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  );
}

/** Every sale saved on this device, kept live as rows change. */
export function useOutbox(): OutboxSale[] {
  const [rows, setRows] = useState<OutboxSale[]>([]);
  useEffect(() => {
    const sub = liveQuery(() => offlineDB.outbox.orderBy('id').toArray()).subscribe({
      next: setRows,
      error: (e) => console.error('[offline] could not read saved sales', e),
    });
    return () => sub.unsubscribe();
  }, []);
  return rows;
}