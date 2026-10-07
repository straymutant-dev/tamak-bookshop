// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

function refresh() {
  revalidatePath('/admin/orders');
  revalidatePath('/admin/dashboard');
}

// Each of these is one database function: it checks the caller is staff/admin,
// changes everything in one transaction, and writes the audit log.

export async function receiveWalkinCheque(orderIds: string[], chequeNumber: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('receive_walkin_cheque', {
    p_order_ids: orderIds,
    p_cheque_number: chequeNumber.trim(),
  });
  if (error) throw new Error(error.message);
  refresh();
}

export async function clearWalkinCheque(phone: string, chequeNumber: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('clear_walkin_cheque', { p_phone: phone, p_cheque_number: chequeNumber });
  if (error) throw new Error(error.message);
  refresh();
}

export async function bounceWalkinCheque(phone: string, chequeNumber: string, note: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('bounce_walkin_cheque', {
    p_phone: phone,
    p_cheque_number: chequeNumber,
    p_note: note.trim() || undefined,
  });
  if (error) throw new Error(error.message);
  refresh();
}

export async function markWalkinNotified(phone: string, chequeNumber: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_walkin_customer_notified', {
    p_phone: phone,
    p_cheque_number: chequeNumber,
  });
  if (error) throw new Error(error.message);
  refresh();
}