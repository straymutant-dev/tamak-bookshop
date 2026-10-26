// STRAYMUTANT.DEV — Tamak Bookshop
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PaymentAccountsManager, { type AccountRow } from './PaymentAccountsManager';

export default async function PaymentDetailsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single();
  if (me?.role !== 'admin') redirect('/admin/dashboard');

  const { data: accounts, error } = await supabase
    .from('payment_accounts')
    .select('id, kind, label, account_name, account_number, details, is_active')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  const rows: AccountRow[] = (accounts ?? []).map((a) => ({
    id: a.id,
    kind: a.kind,
    label: a.label,
    accountName: a.account_name,
    accountNumber: a.account_number,
    details: a.details,
    isActive: a.is_active,
  }));

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-ink">Payment details</h1>
      <p className="mb-6 text-sm text-ink-muted">
        Where customers and vendors pay you. These are shown at checkout and on any order still waiting for payment,
        together with an instruction to use the order number as the payment reference. Only active accounts are shown.
      </p>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load payment details: {error.message}
        </p>
      )}

      <PaymentAccountsManager accounts={rows} />
    </div>
  );
}