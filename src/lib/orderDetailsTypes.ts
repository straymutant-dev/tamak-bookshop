// STRAYMUTANT.DEV — Tamak Bookshop

export interface OrderDetails {
  id: string;
  orderNumber: string;
  createdAt: string;
  paymentMethod: string;
  paymentStatus: string;
  paymentReference: string | null;
  chequeNumber: string | null;
  fulfillmentType: string;
  orderStatus: string;
  subtotalPesewas: number;
  discountPesewas: number;
  totalPesewas: number;
  contactName: string | null;
  contactPhone: string | null;
  items: {
    id: string;
    title: string;
    author: string | null;
    quantity: number;
    unitPricePesewas: number;
    linePesewas: number;
  }[];
}