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

/**
 * Staff record a payment they received from a vendor in person.
 * One database function (record_vendor_repayment) checks the caller is staff/admin,
 * requires a reference for MoMo / bank / cheque, refuses a cheque that hasn't cleared,
 * refuses more than the vendor owes, and lowers the balance in the same transaction.
 */
export async function recordRepayment(formData: FormData) {
  const vendorId = String(formData.get('vendorId') ?? '');
  const amountGhs = Number(formData.get('amount'));
  const method = String(formData.get('paymentMethod') ?? '') as ReceivedMethod;
  const reference = String(formData.get('paymentReference') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim();
  const chequeCleared = formData.get('chequeCleared') === 'on';

  if (!vendorId) throw new Error('Select a vendor');
  if (!Number.isFinite(amountGhs) || amountGhs <= 0) throw new Error('Enter a valid amount');
  if (!METHODS.includes(method)) throw new Error('Choose how the payment was received');

  const supabase = await createClient();
  const { error } = await supabase.rpc('record_vendor_repayment', {
    p_vendor_id: vendorId,
    p_amount_pesewas: ghsToPesewas(amountGhs),
    p_method: method,
    p_reference: reference,
    p_notes: notes || undefined,
    p_cheque_cleared: chequeCleared,
  });
  if (error) throw new Error(error.message);

  refresh();
}