// STRAYMUTANT.DEV — Tamak Bookshop
// Downloads the unpaid-books statement as a PDF.
//   /admin/vendors/statement                -> every vendor who owes money (summary + each vendor's books)
//   /admin/vendors/statement?vendor=<id>    -> one vendor
// It is built fresh on every download, so credit added after 30 days (or any time) shows up with the true total.
import { createClient } from '@/lib/supabase/server';
import { buildStatement, type RawOrder, type RawPayment, type RawVendor } from '@/lib/vendorStatement';
import { renderStatementPdf } from '@/lib/pdf/VendorStatementPdf';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE = 1000; // the database returns at most 1000 rows per request, so read in pages

async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return all;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Not authenticated', { status: 401 });

  const { data: me } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single();
  if (me?.role !== 'admin') return new Response('Only admins can download vendor statements', { status: 403 });

  const vendorId = new URL(request.url).searchParams.get('vendor');
  if (vendorId && !UUID_RE.test(vendorId)) return new Response('Invalid vendor', { status: 400 });

  try {
    let vendorQuery = supabase
      .from('profiles')
      .select('id, full_name, business_name, phone, credit_limit_pesewas, outstanding_balance_pesewas')
      .eq('role', 'vendor');
    if (vendorId) vendorQuery = vendorQuery.eq('id', vendorId);
    const { data: vendorRows, error: vendorError } = await vendorQuery;
    if (vendorError) throw new Error(vendorError.message);

    const vendors = (vendorRows ?? []) as RawVendor[];
    if (vendors.length === 0) return new Response('Vendor not found', { status: 404 });
    const ids = vendors.map((v) => v.id);

    // Every credit order the vendor has placed (approved ones are what they owe; pending ones are shown separately).
    const orders = await fetchAll<RawOrder & { user_id: string; payment_status: string }>((from, to) =>
      supabase
        .from('orders')
        .select(
          'id, user_id, order_number, created_at, total_pesewas, credit_returned_pesewas, payment_status, order_items(quantity, unit_price_pesewas, line_total_pesewas, books(title))'
        )
        .in('user_id', ids)
        .eq('payment_method', 'credit')
        .in('payment_status', ['credit_approved', 'partially_paid', 'credit_pending'])
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to) as unknown as PromiseLike<{
        data: (RawOrder & { user_id: string; payment_status: string })[] | null;
        error: { message: string } | null;
      }>
    );

    const payments = await fetchAll<RawPayment & { vendor_id: string }>((from, to) =>
      supabase
        .from('credit_repayments')
        .select('vendor_id, amount_pesewas, payment_method, payment_reference, created_at')
        .in('vendor_id', ids)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to) as unknown as PromiseLike<{
        data: (RawPayment & { vendor_id: string })[] | null;
        error: { message: string } | null;
      }>
    );

    const statements = vendors.map((vendor) => {
      const mine = orders.filter((o) => o.user_id === vendor.id);
      return buildStatement({
        vendor,
        orders: mine.filter((o) => o.payment_status !== 'credit_pending'),
        payments: payments.filter((p) => p.vendor_id === vendor.id),
        awaitingApprovalPesewas: mine
          .filter((o) => o.payment_status === 'credit_pending')
          .reduce((sum, o) => sum + o.total_pesewas, 0),
      });
    });

    // Same logo file the receipt and the stock report use. If it cannot be loaded the PDF is still produced.
    let logoBytes: Uint8Array | null = null;
    try {
      const res = await fetch(new URL('/images/logo.png', request.url));
      if (res.ok) logoBytes = new Uint8Array(await res.arrayBuffer());
    } catch {
      logoBytes = null;
    }

    const mode = vendorId ? 'single' : 'all';
    const pdf = await renderStatementPdf({
      statements,
      mode,
      preparedBy: me?.full_name ?? user.email ?? 'Admin',
      logoBytes,
    });

    const date = new Date().toISOString().slice(0, 10);
    const slug = (statements[0]?.business ?? statements[0]?.name ?? 'vendor')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    const filename = vendorId ? `tamak-unpaid-${slug || 'vendor'}-${date}.pdf` : `tamak-unpaid-all-vendors-${date}.pdf`;

    const preview = new URL(request.url).searchParams.get('preview') === '1';
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${preview ? 'inline' : 'attachment'}; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('[vendor statement] failed', e);
    return new Response(`Could not build the statement: ${e instanceof Error ? e.message : 'unknown error'}`, { status: 500 });
  }
}