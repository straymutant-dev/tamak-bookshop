// STRAYMUTANT.DEV — Tamak Bookshop
import Link from 'next/link';
import BrandMark from './BrandMark';

const FOOTER_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Books catalog', href: '/store' },
  { label: 'About', href: '/about' },
  { label: 'Track order', href: '/store/track' },
];

const LOGGED_OUT_LINKS = [
  { label: 'Wholesale accounts', href: '/auth/register?type=vendor' },
  { label: 'Log in', href: '/auth/login' },
];

export default function Footer({
  crossHostBase,
  userRole = null,
}: {
  crossHostBase?: string;
  userRole?: 'client' | 'vendor' | 'staff' | 'admin' | null;
}) {
  const dashboardHref =
    userRole === 'admin' || userRole === 'staff'
      ? '/admin/dashboard'
      : userRole === 'vendor'
        ? '/vendor/dashboard'
        : userRole === 'client'
          ? '/account/dashboard'
          : '/';

  const isLoggedIn = userRole !== null;
  const links = [...FOOTER_LINKS, ...(isLoggedIn ? [] : LOGGED_OUT_LINKS)];

  return (
    <footer className="border-t border-border-beige bg-surface-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-5 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-8 sm:text-sm">
        <Link href={dashboardHref} className="flex items-center shrink-0">
          <BrandMark className="h-7 sm:h-8" />
        </Link>
        <nav className="flex flex-wrap gap-x-4 gap-y-1.5 sm:gap-x-6 sm:gap-y-2">
          {links.map((link) =>
            crossHostBase ? (
              <a key={link.href} href={`${crossHostBase}${link.href}`} className="hover:text-brand-green">
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href} className="hover:text-brand-green">
                {link.label}
              </Link>
            )
          )}
        </nav>
      </div>

      <div className="border-t border-border-beige px-6 py-2 text-center text-[10px] text-ink-muted/70 sm:py-3 sm:text-xs">
        Built by StrayMutant — StrayMutant Development · Ghana, {new Date().getFullYear()}
      </div>
    </footer>
  );
}