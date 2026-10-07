// STRAYMUTANT.DEV — Tamak Bookshop
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import VendorCartClient from './VendorCartClient';

export default async function VendorCartPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?redirectTo=/vendor/cart');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, vendor_status, credit_limit_pesewas, outstanding_balance_pesewas')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'vendor') redirect('/store');

  const availableCreditPesewas = Math.max(
    0,
    (profile.credit_limit_pesewas ?? 0) - (profile.outstanding_balance_pesewas ?? 0)
  );

  return (
    <VendorCartClient
      availableCreditPesewas={availableCreditPesewas}
      vendorApproved={profile.vendor_status === 'approved'}
    />
  );
}