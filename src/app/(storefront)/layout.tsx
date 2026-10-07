// STRAYMUTANT.DEV — Tamak Bookshop
import { createClient } from '@/lib/supabase/server';
import Navbar from '@/components/store/Navbar';
import Footer from '@/components/store/Footer';
import AdminSessionBanner from '@/components/store/AdminSessionBanner';

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
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

  const staffOrAdminRole = role === 'admin' || role === 'staff' ? role : null;

  return (
    <div className="flex min-h-screen flex-col bg-surface-cream">
      {staffOrAdminRole && <AdminSessionBanner role={staffOrAdminRole} fullName={fullName} />}
      <Navbar userFullName={fullName} userRole={role} />
      <main className="flex-1">{children}</main>
      <Footer userRole={role} />
    </div>
  );
}