// STRAYMUTANT.DEV — Tamak Bookshop
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatGHS } from '@/lib/currency';
import StatRow from '@/components/admin/StatRow';
import PayBalanceCard from './PayBalanceCard';
import OrderNumberButton from '@/components/orders/OrderNumberButton';
import CreditGauge from './CreditGauge';
import { fetchPaymentAccounts } from '@/lib/paymentAccounts';


const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending approval',
  approved: 'Approved',
  frozen: 'Frozen',
  rejected: 'Not approved',
};

const PAYMENT_LABEL: Record<string, string> = {
  paid: 'Paid',
  payment_pending: 'Awaiting payment confirmation',
  credit_pending: 'Credit — awaiting approval',
  credit_approved: 'On credit account',
  partially_paid: 'Part paid',
};

const REQUEST_LABEL: Record<string, string> = {
  pending: 'Awaiting confirmation',
  confirmed: 'Confirmed',
  rejected: 'Not accepted',
};

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
};

export default async function VendorDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?redirectTo=/vendor/dashboard');

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_name, full_name, phone, vendor_status, credit_limit_pesewas, outstanding_balance_pesewas')
    .eq('id', user.id)
    .single();

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, payment_status, total_pesewas, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const { data: requests } = await supabase
    .from('repayment_requests')
    .select('id, amount_pesewas, payment_method, payment_reference, status, review_note, created_at')
    .eq('vendor_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  const paymentAccounts = await fetchPaymentAccounts(supabase);

  const limit = profile?.credit_limit_pesewas ?? 0;
  const owed = profile?.outstanding_balance_pesewas ?? 0;
  const reserved = (orders ?? [])
    .filter((o) => o.payment_status === 'credit_pending')
    .reduce((sum, o) => sum + o.total_pesewas, 0);
  const available = Math.max(0, limit - owed - reserved);

  const approvedOrders = (orders ?? []).filter((o) => o.payment_status === 'credit_approved');
  const approvedTotal = approvedOrders.reduce((sum, o) => sum + o.total_pesewas, 0);
  const paidSoFar = Math.max(0, approvedTotal - owed);

  const recentOrders = (orders ?? []).slice(0, 5);
  const isApproved = profile?.vendor_status === 'approved';

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-1 font-serif text-2xl text-ink">Welcome back, {profile?.full_name}</h1>
      <p className="mb-6 text-sm text-ink-muted">{profile?.business_name ?? 'Wholesale vendor account'}</p>

      {!isApproved && (
        <div
          className={`mb-6 rounded-md px-4 py-3 text-sm ${
            profile?.vendor_status === 'pending' ? 'bg-accent-gold/10 text-accent-gold' : 'bg-red-50 text-red-700'
          }`}
        >
          {profile?.vendor_status === 'pending'
            ? 'Your account is awaiting approval from Tamak Bookshop staff. You\u2019ll be notified once wholesale credit is enabled.'
            : 'Your wholesale account is not currently active. Contact Tamak Bookshop for details.'}
        </div>
      )}
      
      {isApproved && limit > 0 && (
        <CreditGauge
        limitPesewas={limit}
        usedPesewas={Math.min(limit, owed + reserved)}
        availablePesewas={available}
        canPay={owed > 0}
        />
      )}

      

      <StatRow
        stats={[
          { label: 'Status', value: STATUS_LABEL[profile?.vendor_status ?? 'pending'] },
          { label: 'Credit limit', value: formatGHS(limit) },
          { label: 'Balance owed', value: formatGHS(owed), accent: owed > 0 ? 'terracotta' : undefined },
          { label: 'Reserved (awaiting approval)', value: formatGHS(reserved), accent: reserved > 0 ? 'gold' : undefined },
          { label: 'Available credit', value: formatGHS(available), accent: 'green' },
          { label: 'Total orders', value: orders?.length ?? 0 },
        ]}
      />

      {approvedOrders.length > 0 && (
        <div className="mb-8 rounded-md border border-border-beige bg-surface-card p-5">
          <h2 className="mb-4 text-sm font-medium text-ink-muted">What you owe</h2>

          <div className="mb-4 flex flex-col gap-3">
            {approvedOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between text-sm">
                <div>
                  <OrderNumberButton orderId={o.id} orderNumber={o.order_number} />
                  <div className="text-xs text-ink-muted">
                    Approved credit order ·{' '}
                    {new Date(o.created_at).toLocaleDateString('en-GH', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                </div>
                <span className="text-ink">{formatGHS(o.total_pesewas)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-border-beige pt-3 text-sm">
            <div className="flex justify-between text-ink-muted">
              <span>Approved credit orders</span>
              <span>{formatGHS(approvedTotal)}</span>
            </div>
            <div className="flex justify-between text-ink-muted">
              <span>Paid so far</span>
              <span>− {formatGHS(paidSoFar)}</span>
            </div>
            <div className="mt-1 flex justify-between font-medium text-ink">
              <span>You owe</span>
              <span>{formatGHS(owed)}</span>
            </div>
          </div>
        </div>
      )}

  {isApproved && owed > 0 && (
    <div id="pay-balance">
      <PayBalanceCard
        outstandingPesewas={owed}
        defaultPhone={profile?.phone ?? ''}
        paymentAccounts={paymentAccounts}
      />
    </div>
  )}

      {(requests ?? []).length > 0 && (
        <div className="mb-8 rounded-md border border-border-beige bg-surface-card p-5">
          <h2 className="mb-4 text-sm font-medium text-ink-muted">My payments</h2>
          <div className="flex flex-col gap-3">
            {(requests ?? []).map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <div className="font-medium text-ink">{formatGHS(r.amount_pesewas)}</div>
                  <div className="text-xs text-ink-muted">
                    {METHOD_LABEL[r.payment_method] ?? r.payment_method}
                    {r.payment_reference ? ` · ${r.payment_reference}` : ''}
                    {r.status === 'rejected' && r.review_note ? ` · ${r.review_note}` : ''}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    r.status === 'confirmed'
                      ? 'bg-brand-green/10 text-brand-green'
                      : r.status === 'rejected'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-accent-gold/20 text-accent-gold'
                  }`}
                >
                  {REQUEST_LABEL[r.status] ?? r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-8 rounded-md border border-border-beige bg-surface-card p-5">
        <h2 className="mb-2 text-sm font-medium text-ink-muted">Browse the catalog</h2>
        <p className="mb-3 text-sm text-ink-muted">
          {isApproved
            ? 'Browse the catalog at your wholesale rate and check out on credit, or pay another way.'
            : 'You can browse the catalog now — wholesale pricing and checkout unlock once your account is approved.'}
        </p>
        <Link href="/store" className="text-sm text-brand-green hover:underline">
          Browse books →
        </Link>
      </div>

      <div className="rounded-md border border-border-beige bg-surface-card p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-ink-muted">Recent orders</h2>
          <Link href="/account/orders" className="text-xs text-brand-green hover:underline">
            View all
          </Link>
        </div>

        <div className="flex flex-col gap-3">
          {recentOrders.map((order) => (
            <div key={order.id} className="flex items-center justify-between text-sm">
              <div>
                <OrderNumberButton orderId={order.id} orderNumber={order.order_number} />
                <div className="text-xs text-ink-muted">
                  {PAYMENT_LABEL[order.payment_status] ?? order.payment_status}
                </div>
              </div>
              <span className="text-ink">{formatGHS(order.total_pesewas)}</span>
            </div>
          ))}
          {recentOrders.length === 0 && <p className="text-sm text-ink-muted">No orders yet.</p>}
        </div>
      </div>
    </div>
  );
}