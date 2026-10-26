// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState } from 'react';
import { formatGHS } from '@/lib/currency';
import OrderManageModal from './OrderManageModal';
import ReturnModal from './ReturnModal';
import { canReturnOrder } from '@/lib/returns';
import ReprintButton from './ReprintButton';
import OrderNumberButton from '@/components/orders/OrderNumberButton';

interface OrderRow {
  id: string;
  order_number: string;
  order_type: string;
  payment_method: string;
  payment_status: string;
  total_pesewas: number;
  discount_pesewas: number;
  fulfillment_type: string;
  delivery_address: string | null;
  delivery_notes: string | null;
  order_status: string;
  payment_reference: string | null;
  cheque_number: string | null;
  cheque_cleared: boolean | null;
  contact_name: string | null;
  user_id: string | null;
  staff_id: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, (fulfillment: string) => string> = {
  pending: () => 'Pending',
  in_transit: () => 'In transit',
  completed: (f) => (f === 'delivery' ? 'Delivered' : 'Picked up'),
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  payment_pending: 'Awaiting payment',
  credit_pending: 'Credit awaiting approval',
  credit_approved: 'On credit · unpaid',
  partially_paid: 'Part paid',
};

export default function OrdersTable({
  orders,
  namesById,
}: {
  orders: OrderRow[];
  namesById: Record<string, string>;
}) {
  const [managingOrder, setManagingOrder] = useState<OrderRow | null>(null);
  const [returningOrder, setReturningOrder] = useState<OrderRow | null>(null);

  return (
    <>
      <div className="overflow-x-auto rounded-md border border-border-beige bg-surface-card">
        <table className="w-full text-sm">
          <thead className="bg-surface-cream text-left text-ink-muted">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Sold by</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Fulfillment</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t border-border-beige">
                <td className="px-4 py-3">
                  <OrderNumberButton orderId={order.id} orderNumber={order.order_number} />
                  <div className="text-xs text-ink-muted">
                    {new Date(order.created_at).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-muted">
                  {order.user_id ? namesById[order.user_id] ?? 'Registered customer' : order.contact_name ?? 'Guest'}
                </td>
                <td className="px-4 py-3 text-ink-muted">
                  {order.staff_id ? namesById[order.staff_id] ?? 'Staff' : 'Storefront (self-checkout)'}
                </td>
                <td className="px-4 py-3 text-ink-muted">
                  <span className="capitalize">{order.payment_method.replace('_', ' ')}</span>
                  {order.payment_status !== 'paid' && (
                    <div className="mt-1">
                      <span className="rounded-full bg-accent-terracotta/10 px-2 py-0.5 text-xs font-medium text-accent-terracotta">
                        {PAYMENT_STATUS_LABEL[order.payment_status] ?? 'Unpaid'}
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-ink-muted">
                  <span className="capitalize">{order.fulfillment_type}</span>
                  {' · '}
                  {STATUS_LABEL[order.order_status]?.(order.fulfillment_type) ?? order.order_status}
                </td>
                <td className="px-4 py-3 text-ink">
                  {formatGHS(order.total_pesewas)}
                  {order.discount_pesewas > 0 && (
                    <div className="text-xs text-ink-muted">−{formatGHS(order.discount_pesewas)} discount</div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <ReprintButton orderId={order.id} />
                    {canReturnOrder(order) && (
                      <button
                        onClick={() => setReturningOrder(order)}
                        className="text-sm font-medium text-accent-terracotta hover:underline"
                      >
                        Return
                      </button>
                    )}
                    <button
                      onClick={() => setManagingOrder(order)}
                      className="text-sm font-medium text-brand-green hover:underline"
                    >
                      Manage
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-muted">
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {managingOrder && <OrderManageModal order={managingOrder} onClose={() => setManagingOrder(null)} />}
      {returningOrder && <ReturnModal order={returningOrder} onClose={() => setReturningOrder(null)} />}
    </>
  );
}