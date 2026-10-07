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
    throw new Error('Only staff or admin can manage shifts');
  }

  return { supabase, staffId: user.id };
}

export async function openShift(formData: FormData) {
  const { supabase, staffId } = await assertStaffOrAdmin();

  const { data: existingOpen } = await supabase
    .from('cashier_shifts')
    .select('id')
    .eq('staff_id', staffId)
    .is('closed_at', null)
    .maybeSingle();

  if (existingOpen) throw new Error('You already have an open shift');

  const openingGhs = formData.get('openingCash') as string;
  const openingCashPesewas = ghsToPesewas(Number(openingGhs)) || 0;

  const { error } = await supabase.from('cashier_shifts').insert({
    staff_id: staffId,
    opening_cash_pesewas: openingCashPesewas,
  });

  if (error) throw new Error(error.message);

  revalidatePath('/admin/shift');
}

export async function closeShift(formData: FormData) {
  const { supabase, staffId } = await assertStaffOrAdmin();

  const { data: shift, error: shiftError } = await supabase
    .from('cashier_shifts')
    .select('id, opened_at, opening_cash_pesewas')
    .eq('staff_id', staffId)
    .is('closed_at', null)
    .single();

  if (shiftError || !shift) throw new Error('No open shift found');

  const actualGhs = formData.get('actualCash') as string;
  const actualClosingCashPesewas = ghsToPesewas(Number(actualGhs)) || 0;
  const closedAt = new Date().toISOString();

  const { data: sales } = await supabase
    .from('orders')
    .select('payment_method, total_pesewas')
    .eq('staff_id', staffId)
    .eq('order_type', 'counter_pos')
    .gte('created_at', shift.opened_at)
    .lte('created_at', closedAt);

  let cashSales = 0;
  let momoSales = 0;
  let creditSales = 0;
  for (const sale of sales ?? []) {
    if (sale.payment_method === 'cash') cashSales += sale.total_pesewas;
    else if (sale.payment_method === 'mobile_money') momoSales += sale.total_pesewas;
    else if (sale.payment_method === 'credit') creditSales += sale.total_pesewas;
  }

  const expectedCashPesewas = shift.opening_cash_pesewas + cashSales;
  const discrepancyPesewas = actualClosingCashPesewas - expectedCashPesewas;
  const notes = (formData.get('notes') as string) || null;

  const { error } = await supabase
    .from('cashier_shifts')
    .update({
      closed_at: closedAt,
      actual_closing_cash_pesewas: actualClosingCashPesewas,
      expected_cash_pesewas: expectedCashPesewas,
      expected_momo_pesewas: momoSales,
      expected_credit_pesewas: creditSales,
      shift_discrepancy_pesewas: discrepancyPesewas,
      notes,
    })
    .eq('id', shift.id)
    .eq('staff_id', staffId);

  if (error) throw new Error(error.message);

  await supabase.from('audit_logs').insert({
    staff_id: staffId,
    action: 'shift_closed',
    entity_type: 'cashier_shifts',
    entity_id: shift.id,
    details_json: { expectedCashPesewas, actualClosingCashPesewas, discrepancyPesewas },
  });

  revalidatePath('/admin/shift');
}