// STRAYMUTANT.DEV — Tamak Bookshop
export type ClassLevel =
  | 'KG'
  | 'Primary 1-3'
  | 'Primary 4-6'
  | 'JHS 1-3'
  | 'SHS 1-3'
  | 'General';

export const CLASS_LEVELS: ClassLevel[] = [
  'KG',
  'Primary 1-3',
  'Primary 4-6',
  'JHS 1-3',
  'SHS 1-3',
  'General',
];

export interface Book {
  id: string;
  title: string;
  author: string | null;
  category: string | null;
  subject: string | null;
  class_level: ClassLevel | null;
  academic_year: string | null;
  buying_cost_pesewas: number;
  customer_price_pesewas: number;
  vendor_price_pesewas: number;
  stock_quantity: number;
  damaged_quantity: number;
  is_active: boolean;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export type VendorStatus = 'pending' | 'approved' | 'rejected' | 'frozen';

export interface VendorProfile {
  id: string;
  full_name: string | null;
  business_name: string | null;
  phone: string | null;
  vendor_status: VendorStatus;
  credit_limit_pesewas: number;
  outstanding_balance_pesewas: number;
  created_at: string;
}