// STRAYMUTANT.DEV — Tamak Bookshop
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import Navbar from '@/components/store/Navbar';
import Footer from '@/components/store/Footer';
import AdminHeader from '@/components/admin/AdminHeader';
import { getPortalHosts } from '@/lib/portalHosts';

export default async function AboutLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const host = headersList.get('host') ?? '';
  const { onAdminHost, mainHostFor: rootHost } = getPortalHosts(host);
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const crossHostBase = onAdminHost ? `${protocol}://${rootHost}` : undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let fullName: string | null = null;
  let role: 'client' | 'vendor' | 'staff' | 'admin' | null = null;
  let isSuperAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role, is_super_admin')
      .eq('id', user.id)
      .single();
    fullName = profile?.full_name ?? null;
    role = (profile?.role as 'client' | 'vendor' | 'staff' | 'admin') ?? null;
    isSuperAdmin = profile?.is_super_admin === true;
  }

  if (onAdminHost) {
    return (
      <div className="flex min-h-screen flex-col lg:pl-64">
        <AdminHeader fullName={fullName} email={user?.email ?? null} role={role} isSuperAdmin={isSuperAdmin} />
        <main className="flex-1">{children}</main>
        <Footer crossHostBase={crossHostBase} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar userFullName={fullName} userRole={role} />
      <main className="flex-1">{children}</main>
      <Footer userRole={role} />
    </div>
  );
}