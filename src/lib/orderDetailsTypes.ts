// STRAYMUTANT.DEV — Tamak Bookshop

import type { PaymentAccount } from '@/lib/paymentTypes';

export interface OrderDetails {
  id: string;
  orderNumber: string;
  createdAt: string;
  paymentMethod: string;
  paymentStatus: string;
  paymentReference: string | null;
  chequeNumber: string | null;
  fulfillmentType: string;
  deliveryAddress: string | null;
  deliveryNotes: string | null;
  orderStatus: string;
  subtotalPesewas: number;
  discountPesewas: number;
  totalPesewas: number;
  contactName: string | null;
  contactPhone: string | null;
  /** The signed-in user is the customer who placed this order. */
  isOwner: boolean;
  paymentReportedAt: string | null;
  /** Where to pay — only filled for the customer's own order that is still awaiting payment. */
  paymentAccounts: PaymentAccount[];
  items: {
    id: string;
    title: string;
    author: string | null;
    quantity: number;
    unitPricePesewas: number;
    linePesewas: number;
  }[];
}