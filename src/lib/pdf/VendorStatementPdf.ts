// STRAYMUTANT.DEV — Tamak Bookshop
// Draws the "unpaid books" statement: one vendor, or every vendor that owes money.
import { C, CONTENT_W, MARGIN, PdfKit } from './kit';
import { OVERDUE_DAYS, type VendorStatement } from '@/lib/vendorStatement';

const COL_QTY = 40;
const COL_UNIT = 80;
const COL_AMOUNT = 84;
const COL_TITLE = CONTENT_W - 12 - COL_QTY - COL_UNIT - COL_AMOUNT;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GH', { timeZone: 'Africa/Accra', day: '2-digit', month: 'short', year: 'numeric' });
}

function methodLabel(m: string) {
  return (
    { cash: 'Cash', mobile_money: 'Mobile money', bank_transfer: 'Bank transfer', cheque: 'Cheque', credit: 'Credit' } as Record<
      string,
      string
    >
  )[m] ?? m;
}

export async function renderStatementPdf(opts: {
  statements: VendorStatement[];
  mode: 'single' | 'all';
  preparedBy: string;
  logoBytes?: Uint8Array | null;
  generatedAt?: Date;
}): Promise<Uint8Array> {
  const { statements, mode } = opts;
  const now = opts.generatedAt ?? new Date();
  const kit = await PdfKit.create('Tamak Bookshop — Unpaid books statement', opts.logoBytes);
  const money = (p: number) => kit.money(p);

  const relevant = statements.filter(
    (s) => s.owedPesewas > 0 || s.differencePesewas !== 0 || s.paymentsTotalPesewas > 0
  );
  const totalOwed = statements.reduce((sum, s) => sum + s.owedPesewas, 0);
  const totalPayments = statements.reduce((sum, s) => sum + s.paymentsTotalPesewas, 0);
  const totalOverdue = statements.reduce((sum, s) => sum + s.overduePesewas, 0);
  const totalAwaiting = statements.reduce((sum, s) => sum + s.awaitingApprovalPesewas, 0);
  const unpaidOrders = statements.reduce((sum, s) => sum + s.orders.length, 0);

  // ---------- first page: header, title, details, totals ----------
  kit.header();
  kit.y -= 28;
  kit.text(mode === 'single' ? 'UNPAID BOOKS STATEMENT' : 'ALL VENDORS: UNPAID BOOKS', MARGIN, kit.y, 15, kit.bold, C.green);
  kit.y -= 14;

  const meta: [string, string][] =
    mode === 'single' && statements[0]
      ? [
          ['Vendor', statements[0].business ?? statements[0].name],
          ['Contact', [statements[0].name, statements[0].phone].filter(Boolean).join(' · ')],
          ['Statement date', now.toLocaleString('en-GH', { timeZone: 'Africa/Accra', dateStyle: 'medium', timeStyle: 'short' })],
          ['Prepared by', opts.preparedBy],
        ]
      : [
          ['Statement date', now.toLocaleString('en-GH', { timeZone: 'Africa/Accra', dateStyle: 'medium', timeStyle: 'short' })],
          ['Prepared by', opts.preparedBy],
          ['Vendors listed', String(relevant.length)],
          ['Overdue rule', `Orders older than ${OVERDUE_DAYS} days are marked OVERDUE`],
        ];
  const rowH = 17;
  const metaH = meta.length * rowH + 8;
  kit.rect(MARGIN, kit.y - metaH, CONTENT_W, metaH, C.metaBg, C.line);
  meta.forEach(([label, value], i) => {
    const ry = kit.y - 4 - rowH * (i + 1) + 5;
    kit.text(label, MARGIN + 12, ry, 9.5, kit.font, C.muted);
    kit.right(kit.fit(value, kit.bold, 9.5, CONTENT_W - 140), MARGIN + CONTENT_W - 12, ry, 9.5, kit.bold);
  });
  kit.y -= metaH + 14;

  kit.statBoxes([
    { label: mode === 'single' ? 'OWED NOW' : 'TOTAL OWED', value: money(totalOwed), color: totalOwed > 0 ? C.red : C.green },
    { label: 'PAYMENTS RECEIVED', value: money(totalPayments), color: C.green },
    { label: 'UNPAID ORDERS', value: String(unpaidOrders) },
    { label: `OVERDUE (${OVERDUE_DAYS}+ DAYS)`, value: money(totalOverdue), color: totalOverdue > 0 ? C.red : C.green },
    { label: 'AWAITING APPROVAL', value: money(totalAwaiting), color: C.amber },
  ]);
  kit.text('Awaiting approval is not owed yet. Only approved credit orders count towards the amount owed.', MARGIN, kit.y + 4, 8, kit.font, C.muted);
  kit.y -= 14;

  // ---------- all vendors: one summary table ----------
  if (mode === 'all') {
    const sorted = [...relevant].sort((a, b) => b.owedPesewas - a.owedPesewas || b.paymentsTotalPesewas - a.paymentsTotalPesewas);
    const cols = {
      vendor: MARGIN + 8,
      orders: MARGIN + 280,
      payments: MARGIN + 350,
      oldest: MARGIN + 430,
      owed: MARGIN + CONTENT_W - 8,
    };
    const head = () => {
      kit.rect(MARGIN, kit.y - 22, CONTENT_W, 22, C.headBg);
      kit.hline(kit.y - 22, 1.2, C.green);
      kit.text('VENDOR', cols.vendor, kit.y - 15, 9, kit.bold);
      kit.right('ORDERS', cols.orders + 40, kit.y - 15, 9, kit.bold);
      kit.right('PAID', cols.payments + 40, kit.y - 15, 9, kit.bold);
      kit.right('OLDEST', cols.oldest + 50, kit.y - 15, 9, kit.bold);
      kit.right('OWED', cols.owed, kit.y - 15, 9, kit.bold);
      kit.y -= 22;
    };
    head();
    if (sorted.length === 0) {
      kit.y -= 24;
      kit.text('No vendor owes anything right now.', MARGIN + 8, kit.y, 10, kit.font, C.muted);
      kit.y -= 8;
    }
    for (const s of sorted) {
      if (kit.ensure(22, 'All vendors: unpaid books (continued)')) head();
      const base = kit.y - 14;
      if (s.overduePesewas > 0) kit.rect(MARGIN, kit.y - 20, CONTENT_W, 20, C.redTint);
      kit.text(kit.fit(s.business ?? s.name, kit.font, 9.5, 270), cols.vendor, base, 9.5);
      kit.right(String(s.orders.length), cols.orders + 40, base, 9.5);
      kit.right(money(s.paymentsTotalPesewas), cols.payments + 40, base, 9.5, kit.bold, s.paymentsTotalPesewas > 0 ? C.green : C.ink);
      kit.right(s.orders.length ? `${s.oldestUnpaidDays} days` : '-', cols.oldest + 50, base, 9.5, kit.font, s.oldestUnpaidDays > OVERDUE_DAYS ? C.red : C.ink);
      kit.right(money(s.owedPesewas), cols.owed, base, 9.5, kit.bold);
      kit.hline(kit.y - 20, 0.6, C.rowLine);
      kit.y -= 20;
    }
    if (sorted.length > 0) {
      kit.ensure(40, 'All vendors: unpaid books (continued)');
      kit.y -= 12;
      const bw = CONTENT_W * 0.55;
      kit.rect(MARGIN + CONTENT_W - bw, kit.y - 26, bw, 26, C.green);
      kit.text('TOTAL OWED BY ALL VENDORS', MARGIN + CONTENT_W - bw + 10, kit.y - 17, 10, kit.bold, C.white);
      kit.right(money(totalOwed), MARGIN + CONTENT_W - 10, kit.y - 18, 13, kit.bold, C.white);
      kit.y -= 26;
    }
  }

  // ---------- each vendor in detail ----------
  const detail = mode === 'single' ? statements : [...relevant].sort((a, b) => b.owedPesewas - a.owedPesewas || b.paymentsTotalPesewas - a.paymentsTotalPesewas);
  for (const s of detail) {
    const label = `${s.business ?? s.name}: unpaid books (continued)`;
    if (mode === 'all') kit.newPage();
    else kit.y -= 6;

    // vendor band
    kit.ensure(120, label);
    kit.rect(MARGIN, kit.y - 28, CONTENT_W, 28, C.headBg);
    kit.hline(kit.y - 28, 1.2, C.green);
    kit.text(kit.fit(s.business ?? s.name, kit.bold, 12, CONTENT_W - 190), MARGIN + 10, kit.y - 18, 12, kit.bold, C.green);
    kit.right(`OWED  ${money(s.owedPesewas)}`, MARGIN + CONTENT_W - 10, kit.y - 18, 12, kit.bold, s.owedPesewas > 0 ? C.red : C.green);
    kit.y -= 28;
    kit.text([s.name, s.phone].filter(Boolean).join(' · ') + `   ·   Credit limit ${money(s.creditLimitPesewas)}`, MARGIN + 10, kit.y - 14, 9, kit.font, C.muted);
    kit.y -= 26;

    // account summary
    const lines: [string, string, boolean?][] = [
      ['Credit taken (approved orders, less returns)', money(s.creditTakenPesewas)],
      ['Payments received', `- ${money(s.paymentsTotalPesewas)}`],
      ['Owed by this statement', money(s.owedPesewas), true],
    ];
    for (const [l, v, strong] of lines) {
      kit.text(l, MARGIN + 10, kit.y - 11, 9.5, strong ? kit.bold : kit.font);
      kit.right(v, MARGIN + CONTENT_W - 10, kit.y - 11, 9.5, strong ? kit.bold : kit.font);
      kit.y -= 15;
    }
    kit.text(
      `Age of what is owed:  0-30 days ${money(s.buckets.upTo30)}   |   31-60 days ${money(s.buckets.from31to60)}   |   over 60 days ${money(s.buckets.over60)}`,
      MARGIN + 10, kit.y - 11, 8.5, kit.font, C.muted
    );
    kit.y -= 20;

    if (s.differencePesewas !== 0) {
      kit.ensure(40, label);
      kit.rect(MARGIN, kit.y - 34, CONTENT_W, 34, C.amberTint);
      const msg =
        `Check with an admin: the balance recorded on this account is ${money(s.accountBalancePesewas)}, but the unpaid orders add up to ` +
        `${money(s.owedPesewas)} (difference ${money(Math.abs(s.differencePesewas))}). This can come from an opening balance or a manual change.`;
      kit.wrap(msg, kit.font, 8.5, CONTENT_W - 20, 3).forEach((l, i) => kit.text(l, MARGIN + 10, kit.y - 12 - i * 10.5, 8.5, kit.font, C.amber));
      kit.y -= 42;
    }
    if (s.surplusPesewas > 0) {
      kit.text(`Payments exceed credit taken by ${money(s.surplusPesewas)}.`, MARGIN + 10, kit.y - 10, 8.5, kit.bold, C.amber);
      kit.y -= 16;
    }

    // exact books still owed, grouped by title
    if (s.orders.length > 0) {
      const books = new Map<string, { quantity: number; paidPesewas: number; remainingPesewas: number }>();
      for (const order of s.orders) {
        for (const item of order.items) {
          if (item.remainingPesewas <= 0) continue;
          const current = books.get(item.title) ?? { quantity: 0, paidPesewas: 0, remainingPesewas: 0 };
          current.quantity += item.quantity;
          current.paidPesewas += item.paidPesewas;
          current.remainingPesewas += item.remainingPesewas;
          books.set(item.title, current);
        }
      }

      kit.ensure(48, label);
      kit.text('BOOKS OWED — EXACT TITLES AND PARTIAL PAYMENTS', MARGIN + 2, kit.y - 10, 9, kit.bold, C.green);
      kit.y -= 16;
      for (const [title, book] of books) {
        const status = book.paidPesewas > 0 ? 'PARTIALLY PAID' : 'UNPAID';
        const statusColor = book.paidPesewas > 0 ? C.amber : C.red;
        kit.ensure(28, label);
        kit.text(kit.fit(title, kit.bold, 8.5, CONTENT_W - 170), MARGIN + 8, kit.y - 9, 8.5, kit.bold);
        kit.text(`Qty ${book.quantity}  ·  ${status}`, MARGIN + 8, kit.y - 20, 8, kit.bold, statusColor);
        kit.right(`Paid ${money(book.paidPesewas)}  ·  Still owed ${money(book.remainingPesewas)}`, MARGIN + CONTENT_W - 8, kit.y - 20, 8.5, kit.bold);
        kit.hline(kit.y - 24, 0.4, C.rowLine);
        kit.y -= 28;
      }
    }

    if (s.orders.length === 0) {
      kit.text('No unpaid orders.', MARGIN + 10, kit.y - 12, 10, kit.font, C.muted);
      kit.y -= 24;
    }

    // unpaid orders and their books
    for (const o of s.orders) {
      const unpaidItems = o.items.filter((it) => it.remainingPesewas > 0);
      const itemRows = unpaidItems.map((it) => kit.wrap(it.title, kit.font, 9, COL_TITLE - 4, 2));
      const bodyH = itemRows.reduce((sum, r) => sum + (r.length > 1 ? 24 : 15), 0);
      const extra = (o.returnedPesewas > 0 ? 13 : 0) + (o.paidPesewas > 0 ? 13 : 0);
      // keep an order header together with at least its first book
      kit.ensure(24 + (itemRows[0] ? (itemRows[0].length > 1 ? 24 : 15) : 0) + 24, label);

      kit.rect(MARGIN, kit.y - 22, CONTENT_W, 22, o.overdue ? C.redTint : C.metaBg);
      kit.hline(kit.y - 22, 0.6, C.line);
      kit.text(`${o.orderNumber}`, MARGIN + 8, kit.y - 15, 9.5, kit.bold);
      kit.text(`${fmtDate(o.createdAt)}  ·  ${o.ageDays} ${o.ageDays === 1 ? 'day' : 'days'}`, MARGIN + 170, kit.y - 15, 9, kit.font, C.muted);
      if (o.overdue) kit.text('OVERDUE', MARGIN + 330, kit.y - 15, 8.5, kit.bold, C.red);
      kit.right(`Owed ${money(o.remainingPesewas)}`, MARGIN + CONTENT_W - 8, kit.y - 15, 9.5, kit.bold, o.overdue ? C.red : C.ink);
      kit.y -= 22;

      unpaidItems.forEach((it, i) => {
        const rows = itemRows[i];
        const h = rows.length > 1 ? 24 : 15;
        if (kit.ensure(h + 4, label)) kit.text(`${o.orderNumber} (continued)`, MARGIN + 8, kit.y + 6, 8.5, kit.bold, C.muted);
        rows.forEach((l, li) => kit.text(l, MARGIN + 12, kit.y - 11 - li * 10.5, 9));
        kit.right(String(it.quantity), MARGIN + 12 + COL_TITLE + COL_QTY - 6, kit.y - 11, 9);
        kit.right(money(it.unitPesewas), MARGIN + 12 + COL_TITLE + COL_QTY + COL_UNIT - 6, kit.y - 11, 9);
        kit.right(money(it.linePesewas), MARGIN + CONTENT_W - 8, kit.y - 11, 9);
        kit.y -= h;
        if (it.paidPesewas > 0) {
          kit.ensure(16, label);
          kit.text('PARTIALLY PAID', MARGIN + 12, kit.y - 8, 8, kit.bold, C.amber);
          kit.right(`Paid ${money(it.paidPesewas)}  ·  Still owed ${money(it.remainingPesewas)}`, MARGIN + CONTENT_W - 8, kit.y - 8, 8.5, kit.bold);
          kit.y -= 13;
        } else {
          kit.ensure(16, label);
          kit.text('UNPAID BOOK', MARGIN + 12, kit.y - 8, 8, kit.bold, C.red);
          kit.right(`Still owed ${money(it.remainingPesewas)}`, MARGIN + CONTENT_W - 8, kit.y - 8, 8.5, kit.bold);
          kit.y -= 13;
        }
      });
      void bodyH;
      void extra;

      if (o.returnedPesewas > 0) {
        kit.text('Credited for returned books', MARGIN + 12, kit.y - 10, 8.5, kit.font, C.muted);
        kit.right(`- ${money(o.returnedPesewas)}`, MARGIN + CONTENT_W - 8, kit.y - 10, 8.5, kit.font, C.muted);
        kit.y -= 13;
      }
      if (o.paidPesewas > 0) {
        kit.text('Payments already applied to this order', MARGIN + 12, kit.y - 10, 8.5, kit.font, C.muted);
        kit.right(`- ${money(o.paidPesewas)}`, MARGIN + CONTENT_W - 8, kit.y - 10, 8.5, kit.font, C.muted);
        kit.y -= 13;
      }
      kit.hline(kit.y - 3, 0.6, C.line);
      kit.y -= 12;
    }

    // payments received
    if (s.payments.length > 0) {
      kit.ensure(60, label);
      kit.y -= 6;
      kit.text('PAYMENTS RECEIVED', MARGIN + 2, kit.y - 10, 9, kit.bold, C.green);
      kit.y -= 16;
      for (const p of s.payments) {
        kit.ensure(14, label);
        kit.text(`${fmtDate(p.createdAt)}  ·  ${methodLabel(p.method)}${p.reference ? `  ·  ${p.reference}` : ''}`, MARGIN + 8, kit.y - 9, 8.5, kit.font);
        kit.right(money(p.amountPesewas), MARGIN + CONTENT_W - 8, kit.y - 9, 8.5);
        kit.y -= 13;
      }
      kit.ensure(18, label);
      kit.hline(kit.y - 4, 0.6, C.line);
      kit.text('TOTAL PAYMENTS RECEIVED', MARGIN + 8, kit.y - 14, 8.5, kit.bold, C.green);
      kit.right(money(s.paymentsTotalPesewas), MARGIN + CONTENT_W - 8, kit.y - 14, 9, kit.bold, C.green);
      kit.y -= 20;
    }

    // closing bar for this vendor
    kit.ensure(40, label);
    kit.y -= 10;
    const bw = CONTENT_W * 0.55;
    kit.rect(MARGIN + CONTENT_W - bw, kit.y - 26, bw, 26, C.green);
    kit.text('TOTAL OWED', MARGIN + CONTENT_W - bw + 10, kit.y - 17, 10, kit.bold, C.white);
    kit.right(money(s.owedPesewas), MARGIN + CONTENT_W - 10, kit.y - 18, 13, kit.bold, C.white);
    kit.y -= 26;
  }

  return kit.finish(`Tamak Bookshop · Unpaid books statement · ${now.toLocaleDateString('en-GH', { timeZone: 'Africa/Accra', dateStyle: 'medium' })}`);
}