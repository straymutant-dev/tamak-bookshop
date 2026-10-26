// STRAYMUTANT.DEV — Tamak Bookshop
import { headers } from 'next/headers';
import Navbar from '@/components/store/Navbar';
import Footer from '@/components/store/Footer';
import BrandMark from '@/components/store/BrandMark';
import SiteLogoPattern from '@/components/site/SiteLogoPattern';
import { getPortalHosts } from '@/lib/portalHosts';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const host = headersList.get('host') ?? '';
  const { onAdminHost } = getPortalHosts(host);

  // The admin-portal sign-in page lives on a different host, where the
  // storefront Navbar's /store-style links can't resolve without the same
  // cross-host handling AdminHeader already does for "Open Storefront" —
  // keeping this one page's chrome minimal avoids duplicating that.
  if (onAdminHost) {
    return (
      <div className="auth-shell flex min-h-screen flex-col items-center justify-center px-6 py-16">
        <SiteLogoPattern variant="auth" />
        <div className="mb-8 rounded-2xl border border-white/30 bg-white px-6 py-4 shadow-xl">
          <BrandMark className="h-10" />
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="auth-shell flex min-h-screen flex-col">
      <SiteLogoPattern variant="auth" />
      <Navbar userFullName={null} />
      <main className="auth-main flex-1">{children}</main>
      <Footer />
    </div>
  );
}