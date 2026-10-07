// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ghsToPesewas } from '@/lib/currency';
import { normalizeGhanaPhone } from '@/lib/phone';

const METHODS = ['cash', 'mobile_money', 'bank_transfer', 'cheque'] as const;
type RepayMethod = (typeof METHODS)[number];

/**
 * A vendor says "I paid this much, this way". Nothing about their balance changes
 * here — staff confirm it (with the reference) in /admin/repayments.
 */
export async function submitRepaymentRequest(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, vendor_status, outstanding_balance_pesewas, phone')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'vendor' || profile.vendor_status !== 'approved') {
    throw new Error('Only approved vendor accounts can submit payments');
  }
  if (profile.outstanding_balance_pesewas <= 0) throw new Error('You have no balance to pay');

  const amountGhs = Number(String(formData.get('amount') ?? '').replace(/,/g, ''));
  if (!Number.isFinite(amountGhs) || amountGhs <= 0) throw new Error('Enter the amount you paid');
  const amountPesewas = ghsToPesewas(amountGhs);
  if (amountPesewas > profile.outstanding_balance_pesewas) {
    throw new Error(`That is more than you owe (GHS ${(profile.outstanding_balance_pesewas / 100).toFixed(2)})`);
  }

  const method = String(formData.get('method') ?? '') as RepayMethod;
  if (!METHODS.includes(method)) throw new Error('Choose how you paid');

  const reference = String(formData.get('reference') ?? '').trim() || null;
  if (method !== 'cash' && !reference) {
    throw new Error(method === 'cheque' ? 'Enter the cheque number' : 'Enter the payment reference or transaction ID');
  }

  const rawPhone = String(formData.get('phone') ?? '').trim();
  const phone = rawPhone ? normalizeGhanaPhone(rawPhone) : (profile.phone ?? null);
  if (rawPhone && !phone) throw new Error('Enter a valid phone number, e.g. 024 123 4567');

  const notes = String(formData.get('notes') ?? '').trim() || null;

  const { error } = await supabase.from('repayment_requests').insert({
    vendor_id: user.id,
    amount_pesewas: amountPesewas,
    payment_method: method,
    payment_reference: reference,
    contact_phone: phone,
    notes,
  });
  if (error) throw new Error(error.message);

  revalidatePath('/vendor/dashboard');
  revalidatePath('/admin/repayments');
}