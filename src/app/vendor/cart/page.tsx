// STRAYMUTANT.DEV — Tamak Bookshop
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchPaymentAccounts } from '@/lib/paymentAccounts';
import VendorCartClient from './VendorCartClient';

export default async function VendorCartPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?redirectTo=/vendor/cart');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, phone, vendor_status, credit_limit_pesewas, outstanding_balance_pesewas')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'vendor') redirect('/store');

  // Credit orders still waiting for approval are already reserved against the limit.
  const { data: pendingOrders } = await supabase
    .from('orders')
    .select('total_pesewas')
    .eq('user_id', user.id)
    .eq('payment_status', 'credit_pending');

  const reservedPesewas = (pendingOrders ?? []).reduce((sum, o) => sum + o.total_pesewas, 0);

  const availableCreditPesewas = Math.max(
    0,
    (profile.credit_limit_pesewas ?? 0) - (profile.outstanding_balance_pesewas ?? 0) - reservedPesewas
  );

  const paymentAccounts = await fetchPaymentAccounts(supabase);

  return (
    <VendorCartClient
      availableCreditPesewas={availableCreditPesewas}
      vendorApproved={profile.vendor_status === 'approved'}
      vendorName={profile.full_name ?? 'Vendor'}
      defaultPhone={profile.phone ?? ''}
      paymentAccounts={paymentAccounts}
    />
  );
}