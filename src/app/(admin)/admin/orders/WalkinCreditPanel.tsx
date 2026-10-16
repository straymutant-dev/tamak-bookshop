// STRAYMUTANT.DEV — Tamak Bookshop
import { createClient } from '@/lib/supabase/server';
import WalkinCustomerCard, { type WalkinCustomer } from './WalkinCustomerCard';

export default async function WalkinCreditPanel() {
  const supabase = await createClient();

  // Walk-in credit orders still owed, plus walk-in cheque payments that cleared
  // but whose customer hasn't been told yet.
  const { data: rows, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, contact_name, contact_phone, total_pesewas, created_at, payment_method, payment_status, cheque_number, customer_notified_at'
    )
    .eq('order_type', 'counter_pos')
    .is('user_id', null)
    .or('payment_status.eq.credit_approved,and(payment_status.eq.paid,payment_method.eq.cheque,customer_notified_at.is.null)')
    .order('created_at', { ascending: true });

  const byPhone = new Map<string, WalkinCustomer>();

  for (const row of rows ?? []) {
    const phone = row.contact_phone;
    if (!phone) continue;

    // What is still owed on this order after any returns taken off the debt.
    // `credit_returned_pesewas` is not available on the `orders` table in this schema,
    // so fall back to the raw total when that field is absent.
    const returnedCredit = Number((row as any).credit_returned_pesewas ?? 0);
    const owed = row.total_pesewas - returnedCredit;
    if (row.payment_status === 'credit_approved' && owed <= 0) continue;

    let customer = byPhone.get(phone);
    if (!customer) {
      customer = { name: row.contact_name ?? 'Walk-in vendor', phone, owedPesewas: 0, openOrders: [], pendingCheques: [], clearedCheques: [] };
      byPhone.set(phone, customer);
    }

    if (row.payment_status === 'credit_approved') {
      customer.owedPesewas += owed;
      if (row.cheque_number) {
        const existing = customer.pendingCheques.find((c) => c.number === row.cheque_number);
        if (existing) {
          existing.totalPesewas += owed;
          existing.orderNumbers.push(row.order_number);
        } else {
          customer.pendingCheques.push({
            number: row.cheque_number,
            totalPesewas: owed,
            orderNumbers: [row.order_number],
          });
        }
      } else {
        customer.openOrders.push({
          id: row.id,
          orderNumber: row.order_number,
          createdAt: row.created_at,
          totalPesewas: owed,
        });
      }
    } else if (row.cheque_number) {
      const existing = customer.clearedCheques.find((c) => c.number === row.cheque_number);
      if (existing) {
        existing.totalPesewas += row.total_pesewas;
      } else {
        customer.clearedCheques.push({ number: row.cheque_number, totalPesewas: row.total_pesewas });
      }
    }
  }

  // Customers whose cheques cleared and need telling come first.
  const customers = Array.from(byPhone.values()).sort(
    (a, b) => b.clearedCheques.length - a.clearedCheques.length || b.owedPesewas - a.owedPesewas
  );

  return (
    <div>
      <p className="mb-6 text-sm text-ink-muted">
        Walk-in vendors (no account) who took books on credit. Record the cheque when they bring it, mark it cleared
        once the bank confirms, then tell them. They owe nothing until every order is paid.
      </p>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load walk-in credit: {error.message}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {customers.map((customer) => (
          <WalkinCustomerCard key={customer.phone} customer={customer} />
        ))}
        {customers.length === 0 && !error && (
          <p className="rounded-md border border-border-beige bg-surface-card px-4 py-8 text-center text-sm text-ink-muted">
            No walk-in credit outstanding.
          </p>
        )}
      </div>
    </div>
  );
}