// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// The database only lets admins change these (Row Level Security), so a staff
// member calling these gets "not allowed" even if they find the page.

const KINDS = ['mobile_money', 'bank_transfer'];

function read(formData: FormData) {
  const kind = String(formData.get('kind') ?? '');
  const label = String(formData.get('label') ?? '').trim();
  const accountName = String(formData.get('accountName') ?? '').trim();
  const accountNumber = String(formData.get('accountNumber') ?? '').trim();
  const details = String(formData.get('details') ?? '').trim();

  if (!KINDS.includes(kind)) throw new Error('Choose Mobile Money or Bank transfer');
  if (!label) throw new Error('Enter a label, for example "MTN Mobile Money"');
  if (!accountName) throw new Error('Enter the name on the account');
  if (!accountNumber) throw new Error('Enter the account or phone number');

  return { kind, label, account_name: accountName, account_number: accountNumber, details: details || null };
}

function refresh() {
  revalidatePath('/admin/settings/payments');
}

export async function createPaymentAccount(formData: FormData) {
  const values = read(formData);
  const supabase = await createClient();
  const { error } = await supabase.from('payment_accounts').insert(values);
  if (error) throw new Error(error.message);
  refresh();
}

export async function updatePaymentAccount(id: string, formData: FormData) {
  const values = read(formData);
  const supabase = await createClient();
  const { data, error } = await supabase.from('payment_accounts').update(values).eq('id', id).select('id');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('Not allowed, or that account no longer exists');
  refresh();
}

export async function setPaymentAccountActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('payment_accounts').update({ is_active: active }).eq('id', id).select('id');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('Not allowed, or that account no longer exists');
  refresh();
}

export async function deletePaymentAccount(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('payment_accounts').delete().eq('id', id).select('id');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('Not allowed, or that account no longer exists');
  refresh();
}