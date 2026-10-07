// STRAYMUTANT.DEV — Tamak Bookshop
import { redirect } from 'next/navigation';

// Vendor order approvals now live in Orders → "Vendor orders".
export default function ApprovalsPage() {
  redirect('/admin/orders?tab=vendor');
}