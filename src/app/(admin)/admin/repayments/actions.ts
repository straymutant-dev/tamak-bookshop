// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ghsToPesewas } from '@/lib/currency';

async function assertStaffOrAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin' && profile?.role !== 'staff') {
    throw new Error('Only staff or admin can record repayments');
  }

  return { supabase, staffId: user.id };
}

export async function recordRepayment(formData: FormData) {
  const { supabase, staffId } = await assertStaffOrAdmin();

  const vendorId = formData.get('vendorId') as string;
  const amountGhs = formData.get('amount') as string;
  const paymentMethod = formData.get('paymentMethod') as string;
  const paymentReference = (formData.get('paymentReference') as string) || null;
  const notes = (formData.get('notes') as string) || null;

  if (!vendorId) throw new Error('Select a vendor');
  const amountPesewas = ghsToPesewas(Number(amountGhs));
  if (!amountPesewas || amountPesewas <= 0) throw new Error('Enter a valid amount');

  const { data: vendor, error: vendorError } = await supabase
    .from('profiles')
    .select('outstanding_balance_pesewas')
    .eq('id', vendorId)
    .eq('role', 'vendor')
    .single();

  if (vendorError || !vendor) throw new Error('Vendor not found');
  if (amountPesewas > vendor.outstanding_balance_pesewas) {
    throw new Error(
      `Amount exceeds what this vendor owes (${(vendor.outstanding_balance_pesewas / 100).toFixed(2)} GHS)`
    );
  }

  const { data: repayment, error: repaymentError } = await supabase
    .from('credit_repayments')
    .insert({
      vendor_id: vendorId,
      received_by_staff_id: staffId,
      amount_pesewas: amountPesewas,
      payment_method: paymentMethod,
      payment_reference: paymentReference,
      notes,
    })
    .select('id')
    .single();

  if (repaymentError || !repayment) throw new Error(repaymentError?.message ?? 'Failed to record repayment');

  const { error: balanceError } = await supabase
    .from('profiles')
    .update({ outstanding_balance_pesewas: vendor.outstanding_balance_pesewas - amountPesewas })
    .eq('id', vendorId);

  if (balanceError) throw new Error(balanceError.message);

  await supabase.from('audit_logs').insert({
    staff_id: staffId,
    action: 'vendor_repayment_recorded',
    entity_type: 'credit_repayments',
    entity_id: repayment.id,
    details_json: { vendorId, amountPesewas, paymentMethod },
  });

  revalidatePath('/admin/repayments');
  revalidatePath('/admin/approvals');
  revalidatePath('/vendor/dashboard');
}