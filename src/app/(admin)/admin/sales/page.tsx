// STRAYMUTANT.DEV — Tamak Bookshop
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatGHS } from '@/lib/currency';
import AdminDatePicker from '@/components/admin/AdminDatePicker';

// Ghana is on GMT all year, so a UTC day is the same as a local day.
function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function dayBounds(date: string) {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

interface StaffTotals {
  name: string;
  sales: number;
  salesTotal: number;
  onCredit: number;
  cash: number;
  momo: number;
  bank: number;
  cheque: number;
}

interface Receipt {
  at: string;
  from: string;
  method: string;
  reference: string | null;
  amountPesewas: number;
  staffId: string | null;
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
};

export default async function DailySalesPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date: dateParam } = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateParam ?? '') ? (dateParam as string) : todayUtc();
  const { start, end } = dayBounds(date);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const isAdmin = me?.role === 'admin';

  // Admins see everyone. Staff see only their own sales and receipts.
  let ordersQuery = supabase
    .from('orders')
    .select('staff_id, payment_method, total_pesewas')
    .eq('order_type', 'counter_pos')
    .gte('created_at', start)
    .lt('created_at', end);
  let repaymentsQuery = supabase
    .from('credit_repayments')
    .select('id, vendor_id, received_by_staff_id, payment_method, payment_reference, amount_pesewas, created_at')
    .gte('created_at', start)
    .lt('created_at', end);
  let chequesQuery = supabase
    .from('audit_logs')
    .select('staff_id, details_json, created_at')
    .eq('action', 'walkin_cheque_cleared')
    .gte('created_at', start)
    .lt('created_at', end);

  // Both vendor and customer online-order payment confirmations land here, plus
  // vendor credit approvals (customers have no credit/approval path, so there is
  // no "online_order_approved" to add alongside it).
  let onlineQuery = supabase
    .from('audit_logs')
    .select('staff_id, action, details_json, created_at')
    .in('action', ['vendor_order_payment_confirmed', 'online_order_payment_confirmed', 'vendor_order_approved'])
    .gte('created_at', start)
    .lt('created_at', end);

  if (!isAdmin) {
    onlineQuery = onlineQuery.eq('staff_id', user.id);
    ordersQuery = ordersQuery.eq('staff_id', user.id);
    repaymentsQuery = repaymentsQuery.eq('received_by_staff_id', user.id);
    chequesQuery = chequesQuery.eq('staff_id', user.id);
  }

  const [{ data: orders, error: ordersError }, { data: repayments }, { data: clearedCheques }, { data: onlineEvents }] =
    await Promise.all([ordersQuery, repaymentsQuery, chequesQuery, onlineQuery]);

  const byStaff = new Map<string, StaffTotals>();
  const rowFor = (id: string) => {
    let row = byStaff.get(id);
    if (!row) {
      row = { name: 'Staff', sales: 0, salesTotal: 0, onCredit: 0, cash: 0, momo: 0, bank: 0, cheque: 0 };
      byStaff.set(id, row);
    }
    return row;
  };

  // Counter sales. A counter sale marked "cheque" was originally a walk-in credit
  // sale that was later paid by cheque, so it counts as credit on the day it was sold.
  for (const o of orders ?? []) {
    const row = rowFor(o.staff_id ?? 'unknown');
    row.sales += 1;
    row.salesTotal += o.total_pesewas;
    if (o.payment_method === 'cash') row.cash += o.total_pesewas;
    else if (o.payment_method === 'mobile_money') row.momo += o.total_pesewas;
    else if (o.payment_method === 'bank_transfer') row.bank += o.total_pesewas;
    else row.onCredit += o.total_pesewas;
  }

  // Money received from vendors paying off what they owe, and walk-in cheques that cleared.
  const receipts: Receipt[] = [];

  // Online orders (vendor or customer): staff confirmed the payment (money) or
  // approved the credit (vendor only).
  for (const a of onlineEvents ?? []) {
    if (!a.staff_id) continue;
    const d = (a.details_json ?? {}) as {
      amountPesewas?: number;
      method?: string;
      reference?: string | null;
      orderNumber?: string;
    };
    const amount = d.amountPesewas ?? 0;
    const row = rowFor(a.staff_id);
    row.sales += 1;
    row.salesTotal += amount;

    if (a.action === 'vendor_order_approved') {
      row.onCredit += amount;
      continue;
    }

    if (d.method === 'cash') row.cash += amount;
    else if (d.method === 'mobile_money') row.momo += amount;
    else if (d.method === 'bank_transfer') row.bank += amount;
    else if (d.method === 'cheque') row.cheque += amount;
    receipts.push({
      at: a.created_at,
      from: `order:${d.orderNumber ?? ''}`,
      method: d.method ?? '',
      reference: d.reference ?? null,
      amountPesewas: amount,
      staffId: a.staff_id,
    });
  }

  for (const p of repayments ?? []) {
    if (!p.received_by_staff_id) continue;
    const row = rowFor(p.received_by_staff_id);
    if (p.payment_method === 'cash') row.cash += p.amount_pesewas;
    else if (p.payment_method === 'mobile_money') row.momo += p.amount_pesewas;
    else if (p.payment_method === 'bank_transfer') row.bank += p.amount_pesewas;
    else if (p.payment_method === 'cheque') row.cheque += p.amount_pesewas;
    receipts.push({
      at: p.created_at,
      from: p.vendor_id,
      method: p.payment_method,
      reference: p.payment_reference,
      amountPesewas: p.amount_pesewas,
      staffId: p.received_by_staff_id,
    });
  }

  for (const c of clearedCheques ?? []) {
    if (!c.staff_id) continue;
    const details = (c.details_json ?? {}) as { amountPesewas?: number; chequeNumber?: string; phone?: string };
    const amount = details.amountPesewas ?? 0;
    rowFor(c.staff_id).cheque += amount;
    receipts.push({
      at: c.created_at,
      from: `walkin:${details.phone ?? ''}`,
      method: 'cheque',
      reference: details.chequeNumber ?? null,
      amountPesewas: amount,
      staffId: c.staff_id,
    });
  }

  // Names for staff and vendors
  const profileIds = Array.from(
    new Set([
      ...Array.from(byStaff.keys()).filter((k) => k !== 'unknown'),
      ...receipts.map((r) => r.staffId).filter(Boolean),
      ...receipts.map((r) => r.from).filter((f) => f && !f.startsWith('walkin:')),
    ])
  ) as string[];
  const namesById: Record<string, string> = {};
  if (profileIds.length > 0) {
    const { data: people } = await supabase
      .from('profiles')
      .select('id, full_name, business_name')
      .in('id', profileIds);
    for (const p of people ?? []) namesById[p.id] = p.business_name || p.full_name || 'Unknown';
  }
  for (const [id, row] of byStaff) row.name = id === 'unknown' ? 'Not recorded' : namesById[id] ?? 'Staff';

  const rows = Array.from(byStaff.values()).sort((a, b) => a.name.localeCompare(b.name));
  const total = rows.reduce(
    (t, r) => ({
      sales: t.sales + r.sales,
      salesTotal: t.salesTotal + r.salesTotal,
      onCredit: t.onCredit + r.onCredit,
      cash: t.cash + r.cash,
      momo: t.momo + r.momo,
      bank: t.bank + r.bank,
      cheque: t.cheque + r.cheque,
    }),
    { sales: 0, salesTotal: 0, onCredit: 0, cash: 0, momo: 0, bank: 0, cheque: 0 }
  );

  receipts.sort((a, b) => a.at.localeCompare(b.at));

  const prettyDate = new Date(`${date}T00:00:00.000Z`).toLocaleDateString('en-GH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const cards = [
    { label: 'Cash that should be in the drawer', value: total.cash, strong: true },
    { label: 'Mobile Money received', value: total.momo },
    { label: 'Bank transfers received', value: total.bank },
    { label: 'Cheques received (cleared)', value: total.cheque },
    { label: 'Sold on credit (not money yet)', value: total.onCredit },
  ];

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-ink">{isAdmin ? 'Daily sales' : 'My sales today'}</h1>
      <p className="mb-4 text-sm text-ink-muted">
        {prettyDate}
        {isAdmin ? ' · everyone' : ' · your own sales'}
      </p>

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 text-xs text-ink-muted">
          Date
          <AdminDatePicker name="date" value={date} maxDate={todayUtc()} />
        </div>
        <button type="submit" className="rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white">
          Show
        </button>
      </form>
      
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <form action="/admin/orders" method="get" className="flex gap-2">
          <input
            name="q"
            placeholder="Find an order by number"
            className="rounded-md border border-brand-sage px-3 py-2 text-sm text-ink"
          />
          <button type="submit" className="rounded-md border border-brand-sage px-4 py-2 text-sm text-ink">
            Find
          </button>
        </form>
        <a href={`/admin/orders?from=${date}&to=${date}`} className="text-sm text-brand-green hover:underline">
          See all orders for this day →
        </a>
      </div>

      {ordersError && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load sales: {ordersError.message}
        </p>
      )}

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-md border p-4 ${
              c.strong ? 'border-brand-green bg-brand-green/5' : 'border-border-beige bg-surface-card'
            }`}
          >
            <p className="text-xs text-ink-muted">{c.label}</p>
            <p className={`mt-1 font-semibold ${c.strong ? 'text-lg text-brand-green' : 'text-ink'}`}>
              {formatGHS(c.value)}
            </p>
          </div>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-semibold text-ink">By staff</h2>
      <div className="overflow-x-auto rounded-md border border-border-beige bg-surface-card">
        <table className="w-full text-sm">
          <thead className="bg-surface-cream text-left text-ink-muted">
            <tr>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3 text-right">Sales</th>
              <th className="px-4 py-3 text-right">Sales total</th>
              <th className="px-4 py-3 text-right">Cash</th>
              <th className="px-4 py-3 text-right">MoMo</th>
              <th className="px-4 py-3 text-right">Bank</th>
              <th className="px-4 py-3 text-right">Cheque</th>
              <th className="px-4 py-3 text-right">On credit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name + r.salesTotal} className="border-t border-border-beige">
                <td className="px-4 py-3 text-ink">{r.name}</td>
                <td className="px-4 py-3 text-right text-ink-muted">{r.sales}</td>
                <td className="px-4 py-3 text-right text-ink">{formatGHS(r.salesTotal)}</td>
                <td className="px-4 py-3 text-right font-medium text-ink">{formatGHS(r.cash)}</td>
                <td className="px-4 py-3 text-right text-ink-muted">{formatGHS(r.momo)}</td>
                <td className="px-4 py-3 text-right text-ink-muted">{formatGHS(r.bank)}</td>
                <td className="px-4 py-3 text-right text-ink-muted">{formatGHS(r.cheque)}</td>
                <td className="px-4 py-3 text-right text-ink-muted">{formatGHS(r.onCredit)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-ink-muted">
                  No sales or payments recorded on this day.
                </td>
              </tr>
            )}
            {rows.length > 1 && (
              <tr className="border-t-2 border-border-beige bg-surface-cream font-medium">
                <td className="px-4 py-3 text-ink">Total</td>
                <td className="px-4 py-3 text-right text-ink">{total.sales}</td>
                <td className="px-4 py-3 text-right text-ink">{formatGHS(total.salesTotal)}</td>
                <td className="px-4 py-3 text-right text-ink">{formatGHS(total.cash)}</td>
                <td className="px-4 py-3 text-right text-ink">{formatGHS(total.momo)}</td>
                <td className="px-4 py-3 text-right text-ink">{formatGHS(total.bank)}</td>
                <td className="px-4 py-3 text-right text-ink">{formatGHS(total.cheque)}</td>
                <td className="px-4 py-3 text-right text-ink">{formatGHS(total.onCredit)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Sales are counter sales plus online vendor orders that staff approved or confirmed. Cash, MoMo, Bank and Cheque
        include money received from vendors paying off what they owe. &ldquo;On credit&rdquo; is books taken to be paid
        later &mdash; not money. Cheques count only once they have cleared.
      </p>

      <h2 className="mb-3 mt-10 text-lg font-semibold text-ink">Money received from vendors</h2>
      <div className="overflow-x-auto rounded-md border border-border-beige bg-surface-card">
        <table className="w-full text-sm">
          <thead className="bg-surface-cream text-left text-ink-muted">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Received by</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((r, i) => (
              <tr key={i} className="border-t border-border-beige">
                <td className="px-4 py-3 text-xs text-ink-muted">
                  {new Date(r.at).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
                </td>
                <td className="px-4 py-3 text-ink">
                  {r.from.startsWith('walkin:')
                    ? `Walk-in ${r.from.slice('walkin:'.length)}`
                    : r.from.startsWith('order:')
                    ? `Online order ${r.from.slice('order:'.length)}`
                    : namesById[r.from] ?? 'Vendor'}
                </td>
                <td className="px-4 py-3 text-ink-muted">{METHOD_LABEL[r.method] ?? r.method}</td>
                <td className="px-4 py-3 text-ink-muted">{r.reference ?? '—'}</td>
                <td className="px-4 py-3 text-ink-muted">{r.staffId ? namesById[r.staffId] ?? 'Staff' : '—'}</td>
                <td className="px-4 py-3 text-right font-medium text-ink">{formatGHS(r.amountPesewas)}</td>
              </tr>
            ))}
            {receipts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-muted">
                  No payments received from vendors on this day.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}