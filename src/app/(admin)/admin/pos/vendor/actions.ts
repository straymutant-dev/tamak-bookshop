// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { normalizeGhanaPhone } from '@/lib/phone';
import type { SaleResult } from '../Receipt';

type PosMethod = 'credit' | 'cash' | 'mobile_money' | 'bank_transfer';
const METHODS: PosMethod[] = ['credit', 'cash', 'mobile_money', 'bank_transfer'];

interface RpcSale {
  order_id: string;
  order_number: string;
  created_at: string;
  total_pesewas: number;
  customer_name: string | null;
  customer_phone: string | null;
  on_credit: boolean;
  balance_owed_pesewas: number | null;
  items: { title: string; quantity: number; unit_price_pesewas: number; line_total_pesewas: number }[];
}

/**
 * A counter sale to a vendor — with an account (can be billed to credit) or a
 * walk-in without one (pays at the till). All of it happens inside the
 * pos_vendor_sale database function: prices come from the database, stock comes
 * out, the order is saved and (for credit) the balance rises, or nothing happens.
 */
export async function submitVendorPosSale(formData: FormData): Promise<SaleResult> {
  const vendorId = String(formData.get('vendorId') ?? '') || null;
  const method = String(formData.get('paymentMethod') ?? '') as PosMethod;
  const reference = String(formData.get('paymentReference') ?? '').trim();

  if (!METHODS.includes(method)) throw new Error('Choose a payment method');

  let walkinName: string | null = null;
  let walkinPhone: string | null = null;
  if (!vendorId) {
    walkinName = String(formData.get('walkinName') ?? '').trim();
    if (!walkinName) throw new Error("Enter the vendor's name");
    walkinPhone = normalizeGhanaPhone(String(formData.get('walkinPhone') ?? ''));
    if (!walkinPhone) throw new Error('Enter a valid phone number, e.g. 024 123 4567');
  }

  let items: { bookId: string; quantity: number }[];
  try {
    items = JSON.parse(String(formData.get('items') ?? '[]'));
  } catch {
    throw new Error('Cart data is invalid — please refresh and try again');
  }
  if (!items.length) throw new Error('Cart is empty');

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('pos_vendor_sale', {
    p_vendor_id: vendorId,
    p_walkin_name: walkinName,
    p_walkin_phone: walkinPhone,
    p_items: items.map((i) => ({ bookId: i.bookId, quantity: i.quantity })),
    p_method: method,
    p_reference: reference || undefined,
  });
  if (error) throw new Error(error.message);

  const sale = data as unknown as RpcSale;

  revalidatePath('/admin/pos/vendor');
  revalidatePath('/admin/inventory');
  revalidatePath('/admin/orders');
  revalidatePath('/admin/vendors');
  revalidatePath('/admin/dashboard');

  return {
    orderId: sale.order_id,
    orderNumber: sale.order_number,
    createdAt: sale.created_at,
    items: sale.items,
    totalPesewas: sale.total_pesewas,
    paymentMethod: method,
    paymentReference: reference || null,
    customerName: sale.customer_name,
    customerPhone: sale.customer_phone,
    isCredit: sale.on_credit,
    balanceOwedPesewas: sale.balance_owed_pesewas,
    balanceIsCurrent: false,
  };
}