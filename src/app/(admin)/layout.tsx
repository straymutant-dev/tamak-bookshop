// STRAYMUTANT.DEV — Tamak Bookshop
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminHeader from '@/components/admin/AdminHeader';
import Footer from '@/components/store/Footer';
import LiveRefresh from '@/components/ui/LiveRefresh';
import NotificationToasts from '@/components/notifications/NotificationToasts';
import NotificationsPanel from '@/components/notifications/NotificationsPanel';

export const metadata: Metadata = {
  title: 'Staff portal',
  robots: { index: false, follow: false },
};

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
    .select('role, full_name, is_super_admin, invite_accepted_at')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin' && profile?.role !== 'staff') redirect(crossHostBase);

  // invited but never set a password: send them back to finish
  if (!profile.invite_accepted_at) redirect('/accept-invite');

  return (
    <div className="flex min-h-screen flex-col lg:pl-64">
           <AdminHeader
        fullName={profile.full_name}
        email={user.email ?? null}
        role={profile.role}
        isSuperAdmin={profile.is_super_admin === true}
        notifications={<NotificationsPanel/>}
      />
      <LiveRefresh tables={['orders', 'profiles', 'books', 'repayment_requests', 'credit_repayments', 'audit_logs', 'notifications']} />
      <NotificationToasts />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
      <Footer crossHostBase={crossHostBase} userRole={profile?.role ?? null} />
    </div>
  );
}