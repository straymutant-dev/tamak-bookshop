// STRAYMUTANT.DEV — Tamak Bookshop
// On-device storage for the offline POS (IndexedDB through Dexie):
//   books  - a copy of the catalogue, so the till can search and sell with no internet
//   outbox - every counter sale, saved HERE FIRST, then sent to the server (queue-first)
import Dexie, { type Table } from 'dexie';

export interface CachedBook {
  id: string;
  title: string;
  author: string | null;
  category: string | null;
  subject: string | null;
  class_level: string | null;
  customer_price_pesewas: number;
  stock_quantity: number;
  cover_image_url: string | null;
}

export type OutboxStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface OutboxSale {
  id?: number;
  /** Idempotency key: the server records a sale with this id only once. */
  clientUuid: string;
  /** Printed on the receipt; the server keeps the same number. */
  orderNumber: string;
  soldAt: string;
  items: { bookId: string; title: string; quantity: number; unitPricePesewas: number }[];
  totalPesewas: number;
  paymentMethod: 'cash' | 'mobile_money' | 'bank_transfer';
  paymentReference: string | null;
  customerName: string | null;
  cashierName: string;
  status: OutboxStatus;
  attempts: number;
  lastError: string | null;
  /** Filled in once the server has the sale. */
  orderId: string | null;
  syncedAt: string | null;
  /** Receipts printed before the sale reached the server (logged after it syncs). */
  printCount: number;
  /** Notes from the server (price or stock differences) worth showing the cashier. */
  warnings: string[];
}

export class TamakOfflineDB extends Dexie {
  books!: Table<CachedBook, string>;
  outbox!: Table<OutboxSale, number>;

  constructor() {
    super('tamak-bookshop-pos');
    // v1 was an unused scaffold. v2 is the real thing.
    this.version(1).stores({
      books: 'id, title, category, class_level, updated_at',
      outbox: '++id, client_uuid, synced, created_at',
    });
    this.version(2).stores({
      books: 'id, title',
      outbox: '++id, &clientUuid, status, soldAt',
    });
  }
}

export const offlineDB = new TamakOfflineDB();

/** Replace the saved catalogue with a fresh copy from the server. */
export async function cacheBooks(books: CachedBook[]) {
  await offlineDB.transaction('rw', offlineDB.books, async () => {
    await offlineDB.books.clear();
    await offlineDB.books.bulkPut(books);
  });
}

export async function getCachedBooks(): Promise<CachedBook[]> {
  return offlineDB.books.orderBy('title').toArray();
}

export type NewSale = Pick<
  OutboxSale,
  | 'clientUuid'
  | 'orderNumber'
  | 'soldAt'
  | 'items'
  | 'totalPesewas'
  | 'paymentMethod'
  | 'paymentReference'
  | 'customerName'
  | 'cashierName'
>;

/** Save a sale on this device. Returns the saved row. */
export async function queueSale(sale: NewSale): Promise<OutboxSale> {
  const row: OutboxSale = {
    ...sale,
    status: 'pending',
    attempts: 0,
    lastError: null,
    orderId: null,
    syncedAt: null,
    printCount: 0,
    warnings: [],
  };
  const id = await offlineDB.outbox.add(row);
  return { ...row, id };
}

export async function bumpPrintCount(clientUuid: string) {
  await offlineDB.outbox.where('clientUuid').equals(clientUuid).modify((r) => {
    r.printCount += 1;
  });
}