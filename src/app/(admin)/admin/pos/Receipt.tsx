// STRAYMUTANT.DEV — Tamak Bookshop
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

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Cash',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  credit: 'Credit account',
};

export default function Receipt({ sale, cashierName }: { sale: SaleResult; cashierName: string }) {
  const hasBalance = sale.balanceOwedPesewas !== null && sale.balanceOwedPesewas !== undefined;

  return (
    <div id="thermal-receipt">
      <div style={{ textAlign: 'center', marginBottom: '2mm' }}>
        <strong>TAMAK BOOKSHOP</strong>
        <div>Kasoa, Ghana</div>
      </div>
      <div>--------------------------------</div>
      <div>Order: {sale.orderNumber}</div>
      <div>Date: {new Date(sale.createdAt).toLocaleString()}</div>
      <div>Cashier: {cashierName}</div>
      {sale.customerName && <div>Customer: {sale.customerName}</div>}
      {sale.customerPhone && <div>Phone: {sale.customerPhone}</div>}
      <div>--------------------------------</div>
      {sale.items.map((item, i) => (
        <div key={i} style={{ marginBottom: '1mm' }}>
          <div>{item.title}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>
              {item.quantity} x {formatGHS(item.unit_price_pesewas)}
            </span>
            <span>{formatGHS(item.line_total_pesewas)}</span>
          </div>
        </div>
      ))}
      <div>--------------------------------</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
        <span>TOTAL</span>
        <span>{formatGHS(sale.totalPesewas)}</span>
      </div>

      {sale.isCredit ? (
        <>
          <div style={{ textAlign: 'center', fontWeight: 'bold', margin: '2mm 0' }}>
            *** ON CREDIT - NOT PAID ***
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Charged to account</span>
            <span>{formatGHS(sale.totalPesewas)}</span>
          </div>
          {hasBalance && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>TOTAL BALANCE OWED</span>
              <span>{formatGHS(sale.balanceOwedPesewas as number)}</span>
            </div>
          )}
          {sale.balanceIsCurrent && <div>(balance as of {new Date().toLocaleDateString()})</div>}
          <div style={{ marginTop: '1mm' }}>Pay at the shop or from your vendor dashboard.</div>
        </>
      ) : (
        <>
          <div>Payment: {PAYMENT_LABEL[sale.paymentMethod] ?? sale.paymentMethod}</div>
          {sale.paymentReference && <div>Ref: {sale.paymentReference}</div>}
          {hasBalance && (sale.balanceOwedPesewas as number) > 0 && (
            <div>
              Account balance owed: {formatGHS(sale.balanceOwedPesewas as number)}
              {sale.balanceIsCurrent ? ' (as of today)' : ''}
            </div>
          )}
        </>
      )}

      <div>--------------------------------</div>
      <div style={{ textAlign: 'center', marginTop: '2mm' }}>Thank you for shopping with us!</div>
    </div>
  );
}