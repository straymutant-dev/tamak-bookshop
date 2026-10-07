// STRAYMUTANT.DEV — Tamak Bookshop
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchPaymentAccounts } from '@/lib/paymentAccounts';
import ClientCartPage from './ClientCartPage';

export default async function CartPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let signedInName: string | null = null;
  let signedInPhone: string | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name, phone')
      .eq('id', user.id)
      .single();

    // Wholesale vendors check out from the wholesale cart (credit + wholesale prices).
    if (profile?.role === 'vendor') redirect('/vendor/cart');

    signedInName = profile?.full_name ?? null;
    signedInPhone = profile?.phone ?? null;
  }

  const paymentAccounts = await fetchPaymentAccounts(supabase);

  return (
    <ClientCartPage
      signedInName={signedInName}
      signedInPhone={signedInPhone}
      signedIn={Boolean(user)}
      paymentAccounts={paymentAccounts}
    />
  );
}