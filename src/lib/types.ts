// STRAYMUTANT.DEV — Tamak Bookshop
import type { Database } from '@/lib/database.types';

// Levels the shop sells (the UI lists). 'Tertiary' stays in the DB enum only.
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
  // Whatever the database holds, so rows from Supabase always fit this type.
  class_level: Database['public']['Enums']['class_grade_level'] | null;
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

export type VendorStatus = 'not_applicable' | 'pending' | 'approved' | 'rejected' | 'frozen';

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