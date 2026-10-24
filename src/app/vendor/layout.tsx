// STRAYMUTANT.DEV — Tamak Bookshop
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Navbar from '@/components/store/Navbar';
import Footer from '@/components/store/Footer';
import LiveRefresh from '@/components/ui/LiveRefresh';
import NotificationToasts from '@/components/notifications/NotificationToasts';
import NotificationsPanel from '@/components/notifications/NotificationsPanel';

const REDIRECT_BY_ROLE: Record<string, string> = {
  admin: '/admin/inventory',
  staff: '/admin/inventory',
  client: '/store',
};

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login?redirectTo=/vendor/dashboard');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'vendor') redirect(REDIRECT_BY_ROLE[profile?.role ?? 'client'] ?? '/');

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar userFullName={profile.full_name} userRole="vendor" notifications={<NotificationsPanel />} />
      <LiveRefresh tables={['orders', 'profiles', 'repayment_requests', 'credit_repayments', 'notifications']} />
      <NotificationToasts />
      <main className="flex-1">{children}</main>
      <Footer userRole="vendor" />
    </div>
  );
}