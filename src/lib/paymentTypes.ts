// STRAYMUTANT.DEV — Tamak Bookshop

export interface PaymentAccount {
  id: string;
  kind: 'mobile_money' | 'bank_transfer';
  label: string;
  accountName: string;
  accountNumber: string;
  details: string | null;
}