// STRAYMUTANT.DEV — Tamak Bookshop
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import Navbar from '@/components/store/Navbar';
import Footer from '@/components/store/Footer';
import AdminHeader from '@/components/admin/AdminHeader';
import LiveRefresh from '@/components/ui/LiveRefresh';
import NotificationToasts from '@/components/notifications/NotificationToasts';
import NotificationsPanel from '@/components/notifications/NotificationsPanel';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const host = headersList.get('host') ?? '';
  const onAdminHost = host.startsWith('admin.');
  const rootHost = onAdminHost ? host.slice('admin.'.length) : host;
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const crossHostBase = onAdminHost ? `${protocol}://${rootHost}` : undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let fullName: string | null = null;
  let role: 'client' | 'vendor' | 'staff' | 'admin' | null = null;
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single();
    fullName = profile?.full_name ?? null;
    role = (profile?.role as 'client' | 'vendor' | 'staff' | 'admin') ?? null;
  }

  // Middleware already guarantees only staff/admin ever reach this layout
  // on the admin host — client/vendor sessions are bounced away before
  // they get here, so no separate role check is needed on top of this.
  if (onAdminHost) {
    return (
      <div className="flex min-h-screen flex-col bg-surface-cream">
        <AdminHeader fullName={fullName} notifications={<NotificationsPanel />} />
        <LiveRefresh tables={['orders', 'profiles', 'repayment_requests', 'credit_repayments', 'notifications']} />
        <NotificationToasts />
        <main className="flex-1">{children}</main>
        <Footer crossHostBase={crossHostBase} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-cream">
      <Navbar userFullName={fullName} userRole={role} notifications={<NotificationsPanel />} />
      <LiveRefresh tables={['orders', 'profiles', 'repayment_requests', 'credit_repayments', 'notifications']} />
      <NotificationToasts />
      <main className="flex-1">{children}</main>
<Footer userRole={role} />
    </div>
  );
}