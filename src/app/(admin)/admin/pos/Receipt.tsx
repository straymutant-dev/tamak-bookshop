// STRAYMUTANT.DEV — Tamak Bookshop
import { formatGHS } from '@/lib/currency';

export interface SaleResult {
  orderId:string;
  orderNumber: string;
  createdAt: string;
  items: { title: string; quantity: number; unit_price_pesewas: number; line_total_pesewas: number }[];
  totalPesewas: number;
  paymentMethod: string;
  paymentReference: string | null;
  customerName: string | null;
}

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Cash',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Bank Transfer',
};

export default function Receipt({ sale, cashierName }: { sale: SaleResult; cashierName: string }) {
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
      <div>Payment: {PAYMENT_LABEL[sale.paymentMethod] ?? sale.paymentMethod}</div>
      {sale.paymentReference && <div>Ref: {sale.paymentReference}</div>}
      <div>--------------------------------</div>
      <div style={{ textAlign: 'center', marginTop: '2mm' }}>Thank you for shopping with us!</div>
    </div>
  );
}