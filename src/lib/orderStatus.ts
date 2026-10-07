// STRAYMUTANT.DEV — Tamak Bookshop
export function orderStatusLabel(status: string, fulfillmentType: string): string {
  if (status === 'completed') return fulfillmentType === 'delivery' ? 'Delivered' : 'Picked up';
  if (status === 'in_transit') return 'Out for delivery';
  return 'Pending';
}