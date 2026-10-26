// STRAYMUTANT.DEV — Tamak Bookshop
// Path: src/app/(admin)/admin/pos/Receipt.tsx
'use client';

import { createPortal } from 'react-dom';
import { formatGHS } from '@/lib/currency';

export interface SaleResult {
  orderId: string;
  orderNumber: string;
  createdAt: string;
  items: { title: string; quantity: number; unit_price_pesewas: number; line_total_pesewas: number }[];
  totalPesewas: number;
  paymentMethod: string;
  paymentReference: string | null;
  customerName: string | null;
  customerPhone?: string | null;
  /** Sale billed to a vendor's credit account — NOT paid yet. */
  isCredit?: boolean;
  /** What the vendor owes in total (credit sales, and account vendors generally). */
  balanceOwedPesewas?: number | null;
  /** True on a reprint: the balance is "as of now", not as of the original sale. */
  balanceIsCurrent?: boolean;
}

const SHOP = {
  name: 'TAMAK PUBLICATIONS AND CONSULTING SERVICES',
  address: 'Kasoa, behind old ECG along the Nyanyanu road',
  phone: '0599 118 131',
};

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Cash',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  credit: 'Credit account',
};

export default function Receipt({ sale, cashierName }: { sale: SaleResult; cashierName: string }) {
  // Only ever rendered after a user action (sale done / reprint click), never during SSR.
  if (typeof document === 'undefined') return null;

  const hasBalance = sale.balanceOwedPesewas !== null && sale.balanceOwedPesewas !== undefined;
  const dateText = new Date(sale.createdAt).toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' });

  return createPortal(
    <div id="receipt-root">
      <div id="printable-receipt">
        <div className="rcpt-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.webp" alt="Tamak logo" width={1800} height={432} className="rcpt-logo" />
          <div className="rcpt-shop">
            <div className="rcpt-shop-name">{SHOP.name}</div>
            <div>{SHOP.address}</div>
            <div>Tel: {SHOP.phone}</div>
          </div>
        </div>

        <div className="rcpt-titlebar">
          <div className="rcpt-title">{sale.isCredit ? 'CREDIT SALE RECEIPT' : 'SALES RECEIPT'}</div>
          {sale.isCredit && <div className="rcpt-badge">ON CREDIT</div>}
        </div>

        <div className="rcpt-meta">
          <div>
            <span>Receipt no.</span>
            <strong>{sale.orderNumber}</strong>
          </div>
          <div>
            <span>Date</span>
            <strong>{dateText}</strong>
          </div>
          <div>
            <span>Cashier</span>
            <strong>{cashierName}</strong>
          </div>
          {sale.customerName && (
            <div>
              <span>Customer</span>
              <strong>{sale.customerName}</strong>
            </div>
          )}
          {sale.customerPhone && (
            <div>
              <span>Customer phone</span>
              <strong>{sale.customerPhone}</strong>
            </div>
          )}
          {!sale.isCredit && (
            <div>
              <span>Payment method</span>
              <strong>{PAYMENT_LABEL[sale.paymentMethod] ?? sale.paymentMethod}</strong>
            </div>
          )}
          {!sale.isCredit && sale.paymentReference && (
            <div>
              <span>Reference</span>
              <strong>{sale.paymentReference}</strong>
            </div>
          )}
        </div>

        <table className="rcpt-table">
          <thead>
            <tr>
              <th className="rcpt-idx">#</th>
              <th>Description</th>
              <th className="rcpt-num rcpt-qty">Qty</th>
              <th className="rcpt-num rcpt-money">Unit price</th>
              <th className="rcpt-num rcpt-money">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item, i) => (
              <tr key={i}>
                <td className="rcpt-idx">{i + 1}</td>
                <td>{item.title}</td>
                <td className="rcpt-num rcpt-qty">{item.quantity}</td>
                <td className="rcpt-num rcpt-money">{formatGHS(item.unit_price_pesewas)}</td>
                <td className="rcpt-num rcpt-money">{formatGHS(item.line_total_pesewas)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="rcpt-totals">
          <div className="rcpt-total">
            <span>TOTAL</span>
            <span>{formatGHS(sale.totalPesewas)}</span>
          </div>

          {sale.isCredit ? (
            <>
              <div>
                <span>Charged to account</span>
                <span>{formatGHS(sale.totalPesewas)}</span>
              </div>
              {hasBalance && (
                <div className="rcpt-strong">
                  <span>TOTAL BALANCE OWED</span>
                  <span>{formatGHS(sale.balanceOwedPesewas as number)}</span>
                </div>
              )}
            </>
          ) : (
            hasBalance &&
            (sale.balanceOwedPesewas as number) > 0 && (
              <div>
                <span>Account balance owed{sale.balanceIsCurrent ? ' (as of today)' : ''}</span>
                <span>{formatGHS(sale.balanceOwedPesewas as number)}</span>
              </div>
            )
          )}
        </div>

        {sale.isCredit && (
          <div className="rcpt-credit">
            ON CREDIT — NOT PAID
            <div className="rcpt-credit-sub">
              {sale.balanceIsCurrent && <>Balance as of {new Date().toLocaleDateString('en-GH')}. </>}
              Pay at the shop or check your balance on your vendor dashboard.
            </div>
          </div>
        )}

        <div className="rcpt-foot">Thank you for shopping with us! For enquiries call {SHOP.phone}.</div>
      </div>
    </div>,
    document.body
  );
}