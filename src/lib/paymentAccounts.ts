// STRAYMUTANT.DEV — Tamak Bookshop
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import type { PaymentAccount } from '@/lib/paymentTypes';

/** The shop's active bank / Mobile Money accounts. Readable by everyone, including guests. */
export async function fetchPaymentAccounts(supabase: SupabaseClient<Database>): Promise<PaymentAccount[]> {
  const { data, error } = await supabase
    .from('payment_accounts')
    .select('id, kind, label, account_name, account_number, details')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to load payment details: ${error.message}`);

  return (data ?? []).map((account) => {
    if (account.kind !== 'mobile_money' && account.kind !== 'bank_transfer') {
      throw new Error(`Unsupported payment account method: ${account.kind}`);
    }

    return {
      id: account.id,
      kind: account.kind,
      label: account.label,
      accountName: account.account_name,
      accountNumber: account.account_number,
      details: account.details,
    };
  });
}

export function requirePaymentAccount(
  accounts: PaymentAccount[],
  kind: PaymentAccount['kind']
): void {
  if (!accounts.some((account) => account.kind === kind)) {
    throw new Error(`The shop has not set up an active ${kind === 'mobile_money' ? 'Mobile Money' : 'bank transfer'} account yet.`);
  }
}