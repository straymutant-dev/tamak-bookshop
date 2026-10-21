// STRAYMUTANT.DEV — Tamak Bookshop
// Path: src/lib/offline/hooks.ts
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

/** How many sales on this device have not reached the server yet (waiting, sending, or refused). */
export function useUnsentSalesCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const sub = liveQuery(() => offlineDB.outbox.where('status').anyOf('pending', 'syncing', 'failed').count()).subscribe({
      next: setCount,
      error: (e) => console.error('[offline] could not count saved sales', e),
    });
    return () => sub.unsubscribe();
  }, []);
  return count;
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