// STRAYMUTANT.DEV — Tamak Bookshop
// Works out what a vendor still owes, book by book, from their approved credit orders and their repayments.
//
// Why this is needed: a repayment only lowers the vendor's single balance number; no order is ever marked
// "paid" by it. So every approved credit order stays "On credit — unpaid" forever, and listing those orders
// would overstate the debt. Instead the money received is applied to the OLDEST orders first (the usual way a
// credit statement works): fully covered orders drop off, one order may be part paid, and the newest orders
// stay unpaid. Anything the vendor adds on credit later appears automatically, and nothing is cut off by age.
export const OVERDUE_DAYS = 30;

export interface StatementItem {
  title: string;
  quantity: number;
  unitPesewas: number;
  linePesewas: number;
  paidPesewas: number;
  remainingPesewas: number;
}

export interface StatementOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  ageDays: number;
  overdue: boolean;
  totalPesewas: number;
  returnedPesewas: number;
  paidPesewas: number;
  remainingPesewas: number;
  items: StatementItem[];
}

export interface StatementPayment {
  createdAt: string;
  method: string;
  reference: string | null;
  amountPesewas: number;
}

export interface VendorStatement {
  vendorId: string;
  name: string;
  business: string | null;
  phone: string | null;
  creditLimitPesewas: number;
  /** All approved credit orders, minus anything credited back for returns. */
  creditTakenPesewas: number;
  paymentsTotalPesewas: number;
  /** What the vendor owes by this statement (the unpaid orders added up). */
  owedPesewas: number;
  /** The balance recorded on the vendor's account. Should equal owedPesewas. */
  accountBalancePesewas: number;
  /** accountBalance - owed. Anything other than 0 needs an admin to look at it. */
  differencePesewas: number;
  /** Payments beyond everything taken on credit (shown so it is never hidden). */
  surplusPesewas: number;
  awaitingApprovalPesewas: number;
  oldestUnpaidDays: number;
  overduePesewas: number;
  buckets: { upTo30: number; from31to60: number; over60: number };
  orders: StatementOrder[];
  payments: StatementPayment[];
}

export interface RawVendor {
  id: string;
  full_name: string;
  business_name: string | null;
  phone: string | null;
  credit_limit_pesewas: number;
  outstanding_balance_pesewas: number;
}

export interface RawOrder {
  id: string;
  order_number: string;
  created_at: string;
  total_pesewas: number;
  credit_returned_pesewas: number;
  order_items: {
    quantity: number;
    unit_price_pesewas: number;
    line_total_pesewas: number;
    books: { title: string } | null;
  }[];
}

export interface RawPayment {
  created_at: string;
  payment_method: string;
  payment_reference: string | null;
  amount_pesewas: number;
}

export function buildStatement(input: {
  vendor: RawVendor;
  orders: RawOrder[];
  payments: RawPayment[];
  awaitingApprovalPesewas: number;
  now?: Date;
}): VendorStatement {
  const now = input.now ?? new Date();
  const day = 24 * 60 * 60 * 1000;

  // Oldest first: that is the order the money received is applied in.
  const sorted = [...input.orders].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.order_number.localeCompare(b.order_number)
  );

  const paymentsTotal = input.payments.reduce((sum, p) => sum + p.amount_pesewas, 0);
  let pool = paymentsTotal;
  let creditTaken = 0;
  const unpaid: StatementOrder[] = [];

  for (const o of sorted) {
    const net = Math.max(0, o.total_pesewas - (o.credit_returned_pesewas ?? 0));
    creditTaken += net;
    const paid = Math.min(net, pool);
    pool -= paid;
    const remaining = net - paid;
    if (remaining <= 0) continue;

    let itemPaymentPool = paid;
    const ageDays = Math.max(0, Math.floor((now.getTime() - new Date(o.created_at).getTime()) / day));
    unpaid.push({
      id: o.id,
      orderNumber: o.order_number,
      createdAt: o.created_at,
      ageDays,
      overdue: ageDays > OVERDUE_DAYS,
      totalPesewas: o.total_pesewas,
      returnedPesewas: o.credit_returned_pesewas ?? 0,
      paidPesewas: paid,
      remainingPesewas: remaining,
      items: (o.order_items ?? []).map((i) => {
        const linePesewas = i.line_total_pesewas;
        const paidPesewas = Math.min(linePesewas, itemPaymentPool);
        itemPaymentPool = Math.max(0, itemPaymentPool - paidPesewas);
        return {
          title: i.books?.title ?? 'Book',
          quantity: i.quantity,
          unitPesewas: i.unit_price_pesewas,
          linePesewas,
          paidPesewas,
          remainingPesewas: linePesewas - paidPesewas,
        };
      }),
    });
  }

  const owed = unpaid.reduce((sum, o) => sum + o.remainingPesewas, 0);
  const buckets = { upTo30: 0, from31to60: 0, over60: 0 };
  for (const o of unpaid) {
    if (o.ageDays <= 30) buckets.upTo30 += o.remainingPesewas;
    else if (o.ageDays <= 60) buckets.from31to60 += o.remainingPesewas;
    else buckets.over60 += o.remainingPesewas;
  }

  return {
    vendorId: input.vendor.id,
    name: input.vendor.full_name,
    business: input.vendor.business_name,
    phone: input.vendor.phone,
    creditLimitPesewas: input.vendor.credit_limit_pesewas,
    creditTakenPesewas: creditTaken,
    paymentsTotalPesewas: paymentsTotal,
    owedPesewas: owed,
    accountBalancePesewas: input.vendor.outstanding_balance_pesewas,
    differencePesewas: input.vendor.outstanding_balance_pesewas - owed,
    surplusPesewas: pool,
    awaitingApprovalPesewas: input.awaitingApprovalPesewas,
    oldestUnpaidDays: unpaid.reduce((max, o) => Math.max(max, o.ageDays), 0),
    overduePesewas: buckets.from31to60 + buckets.over60,
    buckets,
    orders: unpaid,
    payments: [...input.payments]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((p) => ({
        createdAt: p.created_at,
        method: p.payment_method,
        reference: p.payment_reference,
        amountPesewas: p.amount_pesewas,
      })),
  };
}