// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { after } from 'next/server';
import { sendOrderEmail } from '@/lib/orderEmail';

type Fulfillment = 'pickup' | 'delivery';
type ReceivedMethod = 'cash' | 'mobile_money' | 'bank_transfer' | 'cheque';

const FULFILLMENTS: Fulfillment[] = ['pickup', 'delivery'];
const METHODS: ReceivedMethod[] = ['cash', 'mobile_money', 'bank_transfer', 'cheque'];

function refresh() {
  revalidatePath('/admin/orders');
  revalidatePath('/admin/inventory');
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/vendors');
  revalidatePath('/vendor/dashboard');
}

// Each of these is ONE database function that checks the caller is staff/admin
// and makes all its changes in a single transaction (see migrations 26 and 27).

export async function approveCreditOrder(orderId: string, fulfillment: Fulfillment) {
  if (!FULFILLMENTS.includes(fulfillment)) throw new Error('Choose pickup or delivery');
  const supabase = await createClient();
  const { error } = await supabase.rpc('approve_vendor_credit_order', {
    p_order_id: orderId,
    p_fulfillment: fulfillment,
  });
  if (error) throw new Error(error.message);
  after(() => sendOrderEmail(orderId, 'credit_approved'));
  refresh();
}

export async function confirmOrderPayment(
  orderId: string,
  fulfillment: Fulfillment,
  method: ReceivedMethod,
  reference: string,
  chequeCleared: boolean
) {
  if (!FULFILLMENTS.includes(fulfillment)) throw new Error('Choose pickup or delivery');
  if (!METHODS.includes(method)) throw new Error('Choose how the payment was received');
  const supabase = await createClient();
  const { error } = await supabase.rpc('confirm_vendor_order_payment', {
    p_order_id: orderId,
    p_method: method,
    p_reference: reference.trim(),
    p_fulfillment: fulfillment,
    p_cheque_cleared: chequeCleared,
  });
  if (error) throw new Error(error.message);
  // Payment approved: email the receipt.
  after(() => sendOrderEmail(orderId, 'paid'));
  refresh();
}

export async function rejectVendorOrder(orderId: string, reason?: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('reject_vendor_order', {
    p_order_id: orderId,
    p_reason: reason?.trim() || undefined,
  });
  if (error) throw new Error(error.message);
  refresh();
}