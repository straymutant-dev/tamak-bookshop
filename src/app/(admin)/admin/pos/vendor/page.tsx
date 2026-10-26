// STRAYMUTANT.DEV — Tamak Bookshop
import { createClient } from '@/lib/supabase/server';
import PosTabs from '../PosTabs';
import VendorPosTerminal from './VendorPosTerminal';
import { fetchPaymentAccounts } from '@/lib/paymentAccounts';

export default async function VendorPosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user!.id).single();
  const paymentAccounts = await fetchPaymentAccounts(supabase);

  const { data: books, error } = await supabase
    .from('books')
    .select('id, title, author, subject, class_level, vendor_price_pesewas, stock_quantity, cover_image_url')
    .eq('is_active', true)
    .gt('stock_quantity', 0)
    .order('title', { ascending: true });

  const { data: vendors } = await supabase
    .from('profiles')
    .select('id, full_name, business_name, phone, credit_limit_pesewas, outstanding_balance_pesewas')
    .eq('role', 'vendor')
    .eq('vendor_status', 'approved')
    .order('business_name', { ascending: true });

  // Credit orders still waiting for approval are already reserved against each limit.
  const { data: pendingCredit } = await supabase
    .from('orders')
    .select('user_id, total_pesewas')
    .eq('payment_status', 'credit_pending');

  const reservedByVendor: Record<string, number> = {};
  for (const o of pendingCredit ?? []) {
    if (o.user_id) reservedByVendor[o.user_id] = (reservedByVendor[o.user_id] ?? 0) + o.total_pesewas;
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-ink">Counter sale</h1>
      <p className="mb-4 text-sm text-ink-muted">Cashier: {profile?.full_name}</p>

      <PosTabs active="vendor" />

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load catalog: {error.message}
        </p>
      )}

      <VendorPosTerminal
        books={books ?? []}
        vendors={(vendors ?? []).map((v) => ({
          id: v.id,
          name: v.business_name || v.full_name || 'Vendor',
          contactName: v.full_name ?? '',
          phone: v.phone ?? '',
          limitPesewas: v.credit_limit_pesewas ?? 0,
          owedPesewas: v.outstanding_balance_pesewas ?? 0,
          reservedPesewas: reservedByVendor[v.id] ?? 0,
        }))}
        cashierName={profile?.full_name ?? 'Staff'}
        paymentAccounts={paymentAccounts}
      />
    </div>
  );
}