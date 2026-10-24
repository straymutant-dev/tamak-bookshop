// STRAYMUTANT.DEV — Tamak Bookshop
// Path: src/components/admin/AdminHeader.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BookOpen,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  PanelLeft,
  Receipt,
  Settings,
  ShoppingCart,
  Store,
  Users,
  UserCog,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import BrandMark from '@/components/store/BrandMark';
import UserAvatar from '@/components/ui/UserAvatar';
import MobileDrawer from '@/components/ui/MobileDrawer';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AdminAccountMenu from '@/components/admin/AdminAccountMenu';
import { signOutAction } from '@/lib/actions/auth';
import OfflineSyncRunner from '@/components/admin/OfflineSyncRunner';
import { useUnsentSalesCount } from '@/lib/offline/hooks';
import { syncOutbox } from '@/lib/offline/sync';

const ALL_LINKS: {
  label: string;
  href: string;
  section: 'Overview' | 'Sales' | 'Catalog' | 'People' | 'Settings';
  icon: LucideIcon;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}[] = [
  { label: 'Dashboard', href: '/admin/dashboard', section: 'Overview', icon: LayoutDashboard },
  { label: 'POS', href: '/admin/pos', section: 'Sales', icon: ShoppingCart },
  { label: 'Orders', href: '/admin/orders', section: 'Sales', icon: ClipboardList },
  { label: 'Daily sales', href: '/admin/sales', section: 'Sales', icon: Receipt },
  { label: 'Repayments', href: '/admin/repayments', section: 'Sales', icon: CreditCard },
  { label: 'Inventory', href: '/admin/inventory', section: 'Catalog', icon: BookOpen },
  { label: 'Vendors', href: '/admin/vendors', section: 'People', icon: Store, adminOnly: true },
  { label: 'Staff', href: '/admin/staff', section: 'People', icon: Users, adminOnly: true },
  { label: 'Team', href: '/admin/team', section: 'People', icon: UserCog, adminOnly: true, superAdminOnly: true },
  { label: 'Activity', href: '/admin/activity', section: 'People', icon: Activity, adminOnly: true },
  { label: 'Payment details', href: '/admin/settings/payments', section: 'Settings', icon: Settings, adminOnly: true },
];

const SIDEBAR_SECTIONS = ['Overview', 'Sales', 'Catalog', 'People', 'Settings'] as const;

export default function AdminHeader({
  fullName,
  email,
  role,
  isSuperAdmin,
  notifications,
}: {
  fullName: string | null;
  email?: string | null;
  role?: string | null;
  isSuperAdmin?: boolean;
  notifications?: React.ReactNode;
}) {

  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const unsent = useUnsentSalesCount();

  const links = ALL_LINKS.filter((link) => {
    if (link.superAdminOnly) {
      return isSuperAdmin;
    }
    if (link.adminOnly) {
      return role === 'admin';
    }
    return true;
  });
  
  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`);

  // One last try to send any saved counter sales before the person is signed out.
  async function beforeSignOut() {
    if (unsent > 0 && navigator.onLine) await syncOutbox().catch(() => {});
  }

  function openStorefront() {
    const { protocol, hostname, port } = window.location;
    const rootHost = hostname.startsWith('admin.') ? hostname.slice('admin.'.length) : hostname;
    const url = `${protocol}//${rootHost}${port ? `:${port}` : ''}/`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <>
      <aside className="admin-sidebar fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border-beige bg-surface-card/95 px-4 py-5 shadow-sm backdrop-blur lg:flex">
        <Link href="/admin/dashboard" className="mb-6 flex items-center shrink-0" onClick={() => setMenuOpen(false)}>
          <BrandMark className="h-9" />
        </Link>

        <nav aria-label="Admin navigation" className="flex flex-1 flex-col gap-5 overflow-y-auto text-sm">
          {SIDEBAR_SECTIONS.map((section) => {
            const sectionLinks = links.filter((link) => link.section === section);
            if (sectionLinks.length === 0) return null;

            return (
              <div key={section}>
                <h2 className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                  {section}
                </h2>
                <div className="flex flex-col gap-1">
                  {sectionLinks.map((link) => {
                    const Icon = link.icon;
                    const active = isActive(link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        aria-current={active ? 'page' : undefined}
                        className={`flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 transition-colors ${
                          active
                            ? 'bg-brand-green/10 font-medium text-brand-green'
                            : 'text-ink-muted hover:bg-surface-cream hover:text-ink'
                        }`}
                      >
                        <Icon size={17} aria-hidden="true" />
                        <span>{link.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="mt-4 border-t border-border-beige pt-4">
          <button
            onClick={openStorefront}
            className="mb-2 flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-ink-muted hover:bg-surface-cream hover:text-ink"
          >
            <Store size={17} aria-hidden="true" />
            Open storefront
            <span className="ml-auto" aria-hidden="true">↗</span>
          </button>
          <Link
            href="/account/settings"
            className={`flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm ${
              isActive('/account/settings')
                ? 'bg-brand-green/10 font-medium text-brand-green'
                : 'text-ink-muted hover:bg-surface-cream hover:text-ink'
            }`}
          >
            <Settings size={17} aria-hidden="true" />
            Account settings
          </Link>
          {fullName && (
            <div className="mt-4 flex items-center gap-3 border-t border-border-beige px-3 pt-4">
              <UserAvatar fullName={fullName} className="h-9 w-9 shrink-0 text-sm" asLink={false} />
              <span className="min-w-0 truncate text-sm font-medium text-ink">{fullName}</span>
              <span className="sr-only">Open the account menu from the top bar for sign out.</span>
            </div>
          )}
        </div>
      </aside>

      <header className="glass-nav glass-nav--admin">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/admin/dashboard" className="flex shrink-0 items-center lg:hidden">
              <BrandMark className="h-8" />
            </Link>
            <button onClick={openStorefront} className="hidden text-sm text-ink-muted hover:text-brand-green sm:block lg:hidden">
              Open storefront ↗
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={openStorefront} className="hidden text-sm text-ink-muted hover:text-brand-green lg:block">
              Open storefront ↗
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="rounded-lg p-2 text-ink hover:bg-surface-cream lg:hidden"
              aria-label="Open sidebar"
              aria-expanded={menuOpen}
            >
              <PanelLeft size={21} aria-hidden="true" />
            </button>
            {notifications}
            {fullName && (
              <AdminAccountMenu
                fullName={fullName}
                email={email ?? null}
                role={role}
                unsentSales={unsent}
                onBeforeLogout={beforeSignOut}
              />
            )}
          </div>
        </div>
        <OfflineSyncRunner />
      </header>

      <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} restrictToMobile={false}>
        <Link href="/admin/dashboard" className="mb-6 flex items-center shrink-0" onClick={() => setMenuOpen(false)}>
          <BrandMark className="h-9" />
        </Link>
        {fullName && (
          <div className="mb-4 flex items-center gap-3">
            <UserAvatar fullName={fullName} className="h-9 w-9 text-sm" asLink={false} />
            <span className="text-sm font-medium text-ink">{fullName}</span>
          </div>
        )}
        <nav aria-label="Admin navigation" className="flex flex-col gap-1 text-sm">
          {links.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 ${
                  active ? 'bg-brand-green/10 font-medium text-brand-green' : 'text-ink'
                }`}
                onClick={() => setMenuOpen(false)}
              >
                <Icon size={17} aria-hidden="true" />
                {link.label}
              </Link>
            );
          })}
          <div className="my-2 border-t border-border-beige" />
          <button
            onClick={() => {
              setMenuOpen(false);
              openStorefront();
            }}
            className="flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-left text-ink-muted"
          >
            <Store size={17} aria-hidden="true" />
            Open storefront ↗
          </button>
          {fullName && (
            <>
              <Link href="/account/settings" className="flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-ink-muted" onClick={() => setMenuOpen(false)}>
                <Settings size={17} aria-hidden="true" />
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

      <ConfirmDialog
        open={confirmingLogout}
        title={unsent > 0 ? 'Sales not sent yet' : 'Log out?'}
        message={
          unsent > 0
            ? `${unsent} counter ${unsent === 1 ? 'sale is' : 'sales are'} saved on this device but ${unsent === 1 ? 'has' : 'have'} not reached the shop system. They stay here and are sent when the internet is back and someone signs in on this device. Do not clear the browser data or switch devices before then.`
            : "You'll need to sign in again to access your account."
        }
        confirmLabel={unsent > 0 ? 'Log out anyway' : 'Log out'}
        cancelLabel="Cancel"
        onCancel={() => setConfirmingLogout(false)}
        onConfirm={async () => {
          await beforeSignOut();
          await signOutAction();
        }}
      />
    </>
  );
}