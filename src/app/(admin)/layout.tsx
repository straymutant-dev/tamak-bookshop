// STRAYMUTANT.DEV — Tamak Bookshop
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminHeader from '@/components/admin/AdminHeader';
import Footer from '@/components/store/Footer';
import LiveRefresh from '@/components/ui/LiveRefresh';
import NotificationToasts from '@/components/notifications/NotificationToasts';
import NotificationsPanel from '@/components/notifications/NotificationsPanel';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const host = headersList.get('host') ?? '';
  const rootHost = host.startsWith('admin.') ? host.slice('admin.'.length) : host;
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const crossHostBase = `${protocol}://${rootHost}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Admin-host login (rewritten to /admin-login by the middleware).
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  // Not staff/admin: send them to the customer site, not "/" on this host.
  if (profile?.role !== 'admin' && profile?.role !== 'staff') redirect(crossHostBase);

  return (
    <div className="flex min-h-screen flex-col bg-surface-cream">
      <AdminHeader fullName={profile?.full_name ?? null} role={profile?.role ?? null} notifications={<NotificationsPanel />} />
      <LiveRefresh tables={['orders', 'profiles', 'books', 'repayment_requests', 'credit_repayments', 'audit_logs', 'notifications']} />
      <NotificationToasts />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
      <Footer crossHostBase={crossHostBase} userRole={profile?.role ?? null} />
    </div>
  );
}