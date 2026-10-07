// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ghsToPesewas } from '@/lib/currency';
import type { VendorStatus } from '@/lib/types';

async function assertAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') throw new Error('Only admins can manage vendor credit');
  return user.id;
}

/** Set (or change) a vendor's credit limit. Admin-only per the credit validation constraint. */
export async function setVendorCreditLimit(formData: FormData) {
  const supabase = await createClient();
  const adminId = await assertAdmin(supabase);

  const vendorId = String(formData.get('vendorId') ?? '');
  const newLimitGHS = Number(formData.get('creditLimit') ?? 0);
  const newLimitPesewas = ghsToPesewas(newLimitGHS);

  if (!vendorId || newLimitPesewas < 0) throw new Error('Invalid vendor or credit limit');

  const { error } = await supabase
    .from('profiles')
    .update({ credit_limit_pesewas: newLimitPesewas })
    .eq('id', vendorId);

  if (error) throw new Error(error.message);

  const { error: auditError } = await supabase.from('audit_logs').insert({
    staff_id: adminId,
    action: 'vendor_credit_limit_set',
    entity_type: 'profiles',
    entity_id: vendorId,
    details_json: { new_limit_pesewas: newLimitPesewas },
  });
  if (auditError) console.error('audit log insert failed:', auditError.message);

  revalidatePath('/admin/vendors');
}

export async function setVendorStatus(vendorId: string, status: VendorStatus) {
  const supabase = await createClient();
  const adminId = await assertAdmin(supabase);

  const { error } = await supabase
    .from('profiles')
    .update({ vendor_status: status })
    .eq('id', vendorId);

  if (error) throw new Error(error.message);

  const { error: auditError } = await supabase.from('audit_logs').insert({
    staff_id: adminId,
    action: 'vendor_status_change',
    entity_type: 'profiles',
    entity_id: vendorId,
    details_json: { new_status: status },
  });
  if (auditError) console.error('audit log insert failed:', auditError.message);

  revalidatePath('/admin/vendors');
}