// STRAYMUTANT.DEV — Tamak Bookshop

// Keep in sync with the 7-day check inside process_order_return() in the database.
export const RETURN_WINDOW_DAYS = 7;

export const RETURNABLE_PAYMENT_STATUSES = ['paid', 'credit_approved', 'partially_paid'];

const DAY_MS = 24 * 60 * 60 * 1000;

export function returnDeadline(createdAt: string): Date {
  return new Date(new Date(createdAt).getTime() + RETURN_WINDOW_DAYS * DAY_MS);
}

/** Cheap check used to decide whether to show the Return button. The database enforces the real rules. */
export function canReturnOrder(order: { order_status: string; payment_status: string; created_at: string }): boolean {
  return (
    order.order_status === 'completed' &&
    RETURNABLE_PAYMENT_STATUSES.includes(order.payment_status) &&
    Date.now() <= returnDeadline(order.created_at).getTime()
  );
}

export interface ReturnInfoItem {
  bookId: string;
  title: string;
  sold: number;
  returned: number;
  remaining: number;
  unitRefundPesewas: number;
}

export interface ReturnInfo {
  orderNumber: string;
  totalPesewas: number;
  items: ReturnInfoItem[];
  deadline: string;
  blockedReason: string | null;
}

export interface ReturnResult {
  orderNumber: string;
  refundPesewas: number;
  creditAppliedPesewas: number;
  cashRefundPesewas: number;
}