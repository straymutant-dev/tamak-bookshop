// STRAYMUTANT.DEV — Tamak Bookshop
import Dexie, { type Table } from 'dexie';

export interface CachedBook {
  id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  category: string | null;
  class_level: string | null;
  customer_price_pesewas: number;
  vendor_price_pesewas: number;
  stock_quantity: number;
  cover_url: string | null;
  updated_at: string;
}

export interface OutboxSale {
  id?: number;
  client_uuid: string; // idempotency key for sync
  items: {
    book_id: string;
    quantity: number;
    unit_price_pesewas: number;
  }[];
  total_pesewas: number;
  pay_method: 'cash' | 'momo' | 'bank_transfer' | 'credit';
  pay_status: 'paid' | 'pending';
  momo_reference: string | null;
  vendor_id: string | null;
  cashier_id: string;
  created_at: string;
  synced: 0 | 1;
  sync_error: string | null;
}

export class TamakOfflineDB extends Dexie {
  books!: Table<CachedBook, string>;
  outbox!: Table<OutboxSale, number>;

  constructor() {
    super('tamak-bookshop-pos');
    this.version(1).stores({
      books: 'id, title, isbn, category, class_level, updated_at',
      outbox: '++id, client_uuid, synced, created_at',
    });
  }
}

export const offlineDB = new TamakOfflineDB();

/** Replace the cached catalog with a fresh snapshot from Supabase */
export async function refreshBookCache(books: CachedBook[]) {
  await offlineDB.transaction('rw', offlineDB.books, async () => {
    await offlineDB.books.clear();
    await offlineDB.books.bulkPut(books);
  });
}

/** Queue a sale made while offline */
export async function queueOfflineSale(sale: Omit<OutboxSale, 'id' | 'synced' | 'sync_error'>) {
  return offlineDB.outbox.add({ ...sale, synced: 0, sync_error: null });
}

/** Get all sales not yet synced to Supabase */
export async function getPendingSales() {
  return offlineDB.outbox.where('synced').equals(0).toArray();
}

export async function markSaleSynced(id: number) {
  return offlineDB.outbox.update(id, { synced: 1, sync_error: null });
}

export async function markSaleFailed(id: number, error: string) {
  return offlineDB.outbox.update(id, { sync_error: error });
}