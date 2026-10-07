// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, Menu } from 'lucide-react';
import { useCart } from '@/lib/cart/CartContext';
import BrandMark from './BrandMark';
import { usePathname } from 'next/navigation';
import UserAvatar from '@/components/ui/UserAvatar';
import MobileDrawer from '@/components/ui/MobileDrawer';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import UserMenuDrawer, { type UserMenuItem } from './UserMenuDrawer';
import { signOutAction } from '@/lib/actions/auth';

export default function Navbar({
  userFullName = null,
  userRole = null,
  crossHostBase,
}: {
  userFullName?: string | null;
  userRole?: 'client' | 'vendor' | 'staff' | 'admin' | null;
  crossHostBase?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const { totalCount } = useCart();
  const pathname = usePathname();
  const isLoggedIn = userFullName !== null;

    const resolveHref = (href: string) => (crossHostBase && href.startsWith('/store') ? `${crossHostBase}${href}` : href);

  const dashboardHref =
    userRole === 'admin' || userRole === 'staff'
      ? '/admin/dashboard'
      : userRole === 'vendor'
      ? '/vendor/dashboard'
      : userRole === 'client'
      ? '/account/dashboard'
      : '/';

  // Account links first, so a logged-in user can always get back to their dashboard.
  const accountLinks: { label: string; href: string }[] = [];
  if (isLoggedIn) {
    accountLinks.push({
      label: userRole === 'admin' || userRole === 'staff' ? 'Admin portal' : 'Dashboard',
      href: dashboardHref,
    });
    if (userRole === 'client' || userRole === 'vendor') {
      accountLinks.push({ label: 'My orders', href: '/account/orders' });
    }
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const NAV_LINKS = [
    ...accountLinks,
    { label: 'Books catalog', href: resolveHref('/store') },
    ...(isLoggedIn ? [] : [{ label: 'Wholesale accounts', href: '/auth/register?type=vendor' }]),
    { label: 'Track order', href: resolveHref('/store/track') },
    { label: 'About', href: '/about' },
  ];
  

  const extraItems: UserMenuItem[] = [];
  if (isLoggedIn) {
    extraItems.push({ label: 'Home', href: '/' });
    extraItems.push({ label: 'Track an order', href: resolveHref('/store/track') });
    if (userRole === 'client' || userRole === 'vendor') {
      extraItems.push({ label: 'My dashboard', href: dashboardHref });
      extraItems.push({ label: 'Order history', href: '/account/orders' });
    }
    if (userRole === 'vendor') {
      extraItems.push({ label: 'Wholesale cart', href: '/vendor/cart' });
    }
    if (userRole === 'staff' || userRole === 'admin') {
      extraItems.push({ label: 'Admin dashboard', href: '/admin/dashboard' });
    }
  }

  return (

    <header className="border-b border-border-beige bg-surface-card">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">

        <Link href={dashboardHref} className="flex items-center shrink-0">
          <BrandMark className="h-8 sm:h-9 md:h-10" />
        </Link>

        <nav className="hidden items-center gap-5 text-sm text-ink md:flex lg:gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`hover:text-brand-green ${isActive(link.href) ? 'font-medium text-brand-green' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Link href={resolveHref('/store/cart')} className="relative text-ink hover:text-brand-green" aria-label="Cart">
            <ShoppingBag size={22} strokeWidth={1.75} />
            {totalCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-accent-terracotta text-[10px] font-medium text-white">
                {totalCount}
              </span>
            )}
          </Link>

          {isLoggedIn ? (
            <button onClick={() => setUserMenuOpen(true)} className="hidden md:block" aria-label="Account menu">
              <UserAvatar fullName={userFullName} className="h-9 w-9 text-sm" asLink={false} />
            </button>
          ) : (
            <Link
              href="/auth/login"
              className="hidden rounded-md border border-brand-sage px-4 py-2 text-sm text-ink hover:border-brand-green hover:text-brand-green md:block"
            >
              Log in
            </Link>
          )}

          <button onClick={() => setMenuOpen(true)} className="text-ink md:hidden" aria-label="Open menu">
            <Menu size={22} />
          </button>
        </div>
      </div>

      <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)}>
        <Link href={dashboardHref} className="mb-6 flex items-center shrink-0" onClick={() => setMenuOpen(false)}>
          <BrandMark className="h-10" />
        </Link>

        {isLoggedIn && (
          <div className="mb-4 flex items-center gap-3">
            <UserAvatar fullName={userFullName} className="h-9 w-9 text-sm" asLink={false} />
            <span className="text-sm font-medium text-ink">{userFullName}</span>
          </div>
        )}
        
        <nav className="flex flex-col gap-1 text-sm text-ink">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`py-2 ${isActive(link.href) ? 'font-medium text-brand-green' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {isLoggedIn ? (
            <>
              <div className="my-2 border-t border-border-beige" />
              <Link
                href={`/account/settings?from=${encodeURIComponent(pathname)}`}
                className="py-2"
                onClick={() => setMenuOpen(false)}
              >
                Account settings
              </Link>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmingLogout(true);
                }}
                className="py-2 text-left text-accent-terracotta"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <div className="my-2 border-t border-border-beige" />
              <Link href="/auth/login" className="py-2 font-medium text-brand-green" onClick={() => setMenuOpen(false)}>
                Log in
              </Link>
            </>
          )}
        </nav>
      </MobileDrawer>

      {isLoggedIn && (
        <UserMenuDrawer
          open={userMenuOpen}
          onClose={() => setUserMenuOpen(false)}
          fullName={userFullName}
          extraItems={extraItems}
        />
      )}

      <ConfirmDialog
        open={confirmingLogout}
        title="Log out?"
        message="You'll need to sign in again to access your account."
        confirmLabel="Log out"
        cancelLabel="Cancel"
        onCancel={() => setConfirmingLogout(false)}
        onConfirm={async () => {
          await signOutAction();
        }}
      />
    </header>
  );
}