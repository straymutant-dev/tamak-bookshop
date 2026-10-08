// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, LayoutGrid, ChevronDown } from 'lucide-react';
import BrandMark from '@/components/store/BrandMark';
import UserAvatar from '@/components/ui/UserAvatar';
import MobileDrawer from '@/components/ui/MobileDrawer';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import UserMenuDrawer from '@/components/store/UserMenuDrawer';
import { signOutAction } from '@/lib/actions/auth';

const ALL_LINKS = [
  { label: 'Dashboard', href: '/admin/dashboard' },
  { label: 'POS', href: '/admin/pos' },
  { label: 'Inventory', href: '/admin/inventory' },
  { label: 'Daily sales', href: '/admin/sales' },
  { label: 'Orders', href: '/admin/orders' },
  { label: 'Repayments', href: '/admin/repayments' },
  { label: 'Vendors', href: '/admin/vendors', adminOnly: true },
  { label: 'Staff', href: '/admin/staff', adminOnly: true },
  { label: 'Team', href: '/admin/team', adminOnly: true },
  { label: 'Activity', href: '/admin/activity', adminOnly: true },
{ label: 'Payment details', href: '/admin/settings/payments', adminOnly: true },
];

export default function AdminHeader({
  fullName,
  role,
  notifications,
}: {
  fullName: string | null;
  role?: string | null;
  notifications?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  const links = ALL_LINKS.filter((link) => !link.adminOnly || role === 'admin');
  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`);
  const currentLink = links.find((link) => isActive(link.href));

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setNavOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function openStorefront() {
    const { protocol, hostname, port } = window.location;
    const rootHost = hostname.startsWith('admin.') ? hostname.slice('admin.'.length) : hostname;
    const url = `${protocol}//${rootHost}${port ? `:${port}` : ''}/`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <header className="border-b border-border-beige bg-surface-card">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/admin/dashboard" className="flex items-center shrink-0">
          <BrandMark className="h-8 sm:h-9 md:h-10" />
        </Link>

        <nav className="hidden items-center gap-6 text-sm md:flex">
          <div ref={navRef} className="relative">
            <button
              onClick={() => setNavOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md border border-border-beige px-3 py-2 text-ink hover:border-brand-sage"
            >
              <LayoutGrid size={16} />
              <span>{currentLink?.label ?? 'Menu'}</span>
              <ChevronDown size={14} className={navOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>

            {navOpen && (
              <div className="absolute left-0 top-full z-20 mt-2 w-48 rounded-md border border-border-beige bg-surface-card py-2 shadow-lg">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setNavOpen(false)}
                    className={`block px-4 py-2 text-sm ${
                      isActive(link.href) ? 'font-medium text-brand-green' : 'text-ink hover:bg-surface-cream'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <span className="text-border-beige">|</span>

          <button onClick={openStorefront} className="text-ink-muted hover:text-brand-green">
            Open Storefront ↗
          </button>
        </nav>

        <div className="flex items-center gap-4">
          {notifications}
          {fullName && (
            <button onClick={() => setUserMenuOpen(true)} className="hidden md:block" aria-label="Account menu">
              <UserAvatar fullName={fullName} className="h-9 w-9 text-sm" asLink={false} />
            </button>
          )}
          <button onClick={() => setMenuOpen(true)} className="text-ink md:hidden" aria-label="Open menu">
            <Menu size={22} />
          </button>
        </div>
      </div>

      <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)}>
        <Link href="/admin/dashboard" className="mb-6 flex items-center shrink-0" onClick={() => setMenuOpen(false)}>
          <BrandMark className="h-9" />
        </Link>

        {fullName && (
          <div className="mb-4 flex items-center gap-3">
            <UserAvatar fullName={fullName} className="h-9 w-9 text-sm" asLink={false} />
            <span className="text-sm font-medium text-ink">{fullName}</span>
          </div>
        )}

        <nav className="flex flex-col gap-1 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`py-2 ${isActive(link.href) ? 'font-medium text-brand-green' : 'text-ink'}`}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="my-2 border-t border-border-beige" />
          <button
            onClick={() => {
              setMenuOpen(false);
              openStorefront();
            }}
            className="py-2 text-left text-ink-muted"
          >
            Open Storefront ↗
          </button>
          {fullName && (
            <>
              <div className="my-2 border-t border-border-beige" />
              <Link href="/account/settings" className="py-2" onClick={() => setMenuOpen(false)}>
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
          )}
        </nav>
      </MobileDrawer>

      {fullName && <UserMenuDrawer open={userMenuOpen} onClose={() => setUserMenuOpen(false)} fullName={fullName} />}

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