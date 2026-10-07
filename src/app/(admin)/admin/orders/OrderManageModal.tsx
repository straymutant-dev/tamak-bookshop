// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState, useTransition } from 'react';
import { pesewasToGHS } from '@/lib/currency';
import { updateOrderStatus } from './actions';
import { useToast } from '@/components/ui/ToastContext';

interface ManagedOrder {
  id: string;
  order_number: string;
  payment_method: string;
  fulfillment_type: string;
  order_status: string;
  discount_pesewas: number;
  payment_reference: string | null;
  cheque_number: string | null;
  cheque_cleared: boolean | null;
}

export default function OrderManageModal({
  order,
  onClose,
}: {
  order: ManagedOrder;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fulfillmentType, setFulfillmentType] = useState(order.fulfillment_type);
  const { showToast } = useToast();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateOrderStatus(order.id, formData);
        showToast('Order updated successfully');
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-surface-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-ink">Manage order {order.order_number}</h2>

        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <form action={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Fulfillment
            <select
              name="fulfillmentType"
              defaultValue={order.fulfillment_type}
              onChange={(e) => setFulfillmentType(e.target.value)}
              className="rounded-md border border-brand-sage px-3 py-2"
            >
              <option value="pickup">Pickup</option>
              <option value="delivery">Delivery</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Status
            <select
              name="orderStatus"
              defaultValue={order.order_status}
              className="rounded-md border border-brand-sage px-3 py-2"
            >
              <option value="pending">Pending</option>
              {fulfillmentType === 'delivery' && <option value="in_transit">In transit</option>}
              <option value="completed">{fulfillmentType === 'delivery' ? 'Delivered' : 'Picked up'}</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Discount given (GHS)
            <input
              name="discount"
              type="number"
              step="0.01"
              min="0"
              defaultValue={order.discount_pesewas ? pesewasToGHS(order.discount_pesewas) : ''}
              placeholder="0.00"
              className="rounded-md border border-brand-sage px-3 py-2"
            />
          </label>

          <input type="hidden" name="paymentMethod" value={order.payment_method} />

          {order.payment_method === 'mobile_money' && (
            <label className="flex flex-col gap-1 text-sm">
              Mobile money transaction ID
              <input
                name="paymentReference"
                defaultValue={order.payment_reference ?? ''}
                placeholder="e.g. MM240912.1345.A12345"
                className="rounded-md border border-brand-sage px-3 py-2"
              />
            </label>
          )}

          {order.payment_method === 'cheque' && (
            <>
              <label className="flex flex-col gap-1 text-sm">
                Cheque number
                <input
                  name="chequeNumber"
                  defaultValue={order.cheque_number ?? ''}
                  className="rounded-md border border-brand-sage px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Cleared?
                <select
                  name="chequeCleared"
                  defaultValue={order.cheque_cleared === null ? '' : order.cheque_cleared ? 'true' : 'false'}
                  className="rounded-md border border-brand-sage px-3 py-2"
                >
                  <option value="">Not yet checked</option>
                  <option value="true">Cleared</option>
                  <option value="false">Bounced</option>
                </select>
              </label>
            </>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border-beige px-4 py-2 text-sm text-ink-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-brand-green px-4 py-2 text-sm text-surface-cream disabled:opacity-50"
            >
              {isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}