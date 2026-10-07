// STRAYMUTANT.DEV — Tamak Bookshop
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import type { PaymentAccount } from '@/lib/paymentTypes';

/** The shop's active bank / Mobile Money accounts. Readable by everyone, including guests. */
export async function fetchPaymentAccounts(supabase: SupabaseClient<Database>): Promise<PaymentAccount[]> {
  const { data } = await supabase
    .from('payment_accounts')
    .select('id, kind, label, account_name, account_number, details')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  return (data ?? []).map((a) => ({
    id: a.id,
    kind: a.kind === 'bank_transfer' ? 'bank_transfer' : 'mobile_money',
    label: a.label,
    accountName: a.account_name,
    accountNumber: a.account_number,
    details: a.details,
  }));
}