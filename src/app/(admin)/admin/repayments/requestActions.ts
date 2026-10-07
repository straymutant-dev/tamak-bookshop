// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ghsToPesewas } from '@/lib/currency';

type ReceivedMethod = 'cash' | 'mobile_money' | 'bank_transfer' | 'cheque';
const METHODS: ReceivedMethod[] = ['cash', 'mobile_money', 'bank_transfer', 'cheque'];

function refresh() {
  revalidatePath('/admin/repayments');
  revalidatePath('/admin/vendors');
  revalidatePath('/vendor/dashboard');
}

/** Confirm a payment a vendor says they made. Staff can correct amount / method / reference first. */
export async function confirmRepaymentRequest(
  requestId: string,
  amountGhs: number,
  method: ReceivedMethod,
  reference: string,
  chequeCleared: boolean
) {
  if (!Number.isFinite(amountGhs) || amountGhs <= 0) throw new Error('Enter the amount received');
  if (!METHODS.includes(method)) throw new Error('Choose how the payment was received');

  const supabase = await createClient();
  const { error } = await supabase.rpc('confirm_repayment_request', {
    p_request_id: requestId,
    p_amount_pesewas: ghsToPesewas(amountGhs),
    p_method: method,
    p_reference: reference.trim(),
    p_cheque_cleared: chequeCleared,
  });
  if (error) throw new Error(error.message);

  refresh();
}

export async function rejectRepaymentRequest(requestId: string, note: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('reject_repayment_request', {
    p_request_id: requestId,
    p_note: note.trim() || undefined,
  });
  if (error) throw new Error(error.message);

  refresh();
}