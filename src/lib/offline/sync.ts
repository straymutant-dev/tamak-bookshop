// STRAYMUTANT.DEV — Tamak Bookshop
// Sends the sales saved on this device to the server, one at a time, in the order they were made.
// Safe to call as often as you like: it does nothing if there is nothing to send, no connection,
// or another sync is already running (this tab, or another tab via the Web Locks API).
import { offlineDB } from './db';
import { syncPosSale } from '@/app/(admin)/admin/pos/actions';
import { logReceiptPrint } from '@/lib/actions/receipts';

export interface SyncSummary {
  synced: number;
  failed: number;
  /** True when the server could not be reached, so the sales stay queued. */
  offline: boolean;
}

let running = false;
const KEEP_SYNCED_MS = 3 * 24 * 60 * 60 * 1000;

export async function syncOutbox(): Promise<SyncSummary> {
  const summary: SyncSummary = { synced: 0, failed: 0, offline: false };
  if (typeof navigator === 'undefined') return summary;
  if (!navigator.onLine) {
    summary.offline = true;
    return summary;
  }
  if (running) return summary;
  running = true;
  try {
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    if (locks) {
      await locks.request('tamak-pos-sync', { ifAvailable: true }, async (lock) => {
        if (lock) await drain(summary);
      });
    } else {
      await drain(summary);
    }
  } catch (e) {
    console.error('[offline] sync failed', e);
    summary.offline = true;
  } finally {
    running = false;
  }
  return summary;
}

async function drain(summary: SyncSummary) {
  // Anything still marked "syncing" was cut off (tab closed, signal lost): try it again.
  await offlineDB.outbox.where('status').equals('syncing').modify({ status: 'pending' });

  // Tidy up: sales that reached the server a few days ago no longer need to be kept here.
  const cutoff = new Date(Date.now() - KEEP_SYNCED_MS).toISOString();
  await offlineDB.outbox
    .where('status')
    .equals('synced')
    .filter((r) => !!r.syncedAt && r.syncedAt < cutoff)
    .delete();

  const pending = await offlineDB.outbox.where('status').equals('pending').sortBy('id');

  for (const row of pending) {
    const id = row.id!;
    await offlineDB.outbox.update(id, { status: 'syncing', attempts: row.attempts + 1 });

    let result;
    try {
      result = await syncPosSale({
        clientUuid: row.clientUuid,
        orderNumber: row.orderNumber,
        soldAt: row.soldAt,
        customerName: row.customerName,
        paymentMethod: row.paymentMethod,
        paymentReference: row.paymentReference,
        items: row.items.map((i) => ({
          bookId: i.bookId,
          quantity: i.quantity,
          unitPricePesewas: i.unitPricePesewas,
        })),
      });
    } catch {
      // The request itself failed (no signal, signed out, server unreachable): keep it and stop.
      await offlineDB.outbox.update(id, { status: 'pending', lastError: 'Could not reach the server' });
      summary.offline = true;
      return;
    }

    if (result.ok) {
      await offlineDB.outbox.update(id, {
        status: 'synced',
        orderId: result.orderId,
        syncedAt: new Date().toISOString(),
        lastError: null,
        warnings: result.warnings,
      });
      summary.synced++;
      // Receipts printed while offline could not be logged then; log them now.
      for (let i = 0; i < row.printCount; i++) {
        try {
          await logReceiptPrint(result.orderId);
        } catch (e) {
          console.error('[offline] could not log receipt print', e);
        }
      }
    } else if (result.retryable) {
      await offlineDB.outbox.update(id, { status: 'pending', lastError: result.error });
      summary.offline = true;
      return;
    } else {
      // The server refused this sale for a real reason. Keep it visible so a person can look at it.
      await offlineDB.outbox.update(id, { status: 'failed', lastError: result.error });
      summary.failed++;
    }
  }
}