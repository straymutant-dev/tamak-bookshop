// STRAYMUTANT.DEV — Tamak Bookshop
import { headers } from 'next/headers';
import Navbar from '@/components/store/Navbar';
import Footer from '@/components/store/Footer';
import BrandMark from '@/components/store/BrandMark';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const host = headersList.get('host') ?? '';
  const onAdminHost = host.startsWith('admin.');

  // The admin-portal sign-in page lives on a different host, where the
  // storefront Navbar's /store-style links can't resolve without the same
  // cross-host handling AdminHeader already does for "Open Storefront" —
  // keeping this one page's chrome minimal avoids duplicating that.
  if (onAdminHost) {
    return (
      <div className="auth-shell flex min-h-screen flex-col items-center justify-center px-6 py-16">
        <BrandMark className="mb-8 h-10" />
        {children}
      </div>
    );
  }

  return (
    <div className="auth-shell flex min-h-screen flex-col">
      <Navbar userFullName={null} />
      <main className="auth-main flex-1">{children}</main>
      <Footer />
    </div>
  );
}