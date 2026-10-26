// STRAYMUTANT.DEV — Tamak Bookshop
import { createClient } from '@/lib/supabase/server';
import PosTerminal from './PosTerminal';
import PosTabs from './PosTabs';
import { fetchPaymentAccounts } from '@/lib/paymentAccounts';

export default async function PosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user!.id).single();
  const paymentAccounts = await fetchPaymentAccounts(supabase);

  const { data: books, error } = await supabase
    .from('books')
    .select('id, title, author, category, subject, class_level, customer_price_pesewas, stock_quantity, cover_image_url')
    .eq('is_active', true)
    .gt('stock_quantity', 0)
    .order('title', { ascending: true });

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-ink">Counter sale</h1>
      <p className="mb-4 text-sm text-ink-muted">Cashier: {profile?.full_name}</p>

      <PosTabs active="retail" />

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load catalog: {error.message}
        </p>
      )}

      <PosTerminal
        books={books ?? []}
        cashierName={profile?.full_name ?? 'Staff'}
        paymentAccounts={paymentAccounts}
      />
    </div>
  );
}