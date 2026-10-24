'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, LogOut, Settings, UserRound } from 'lucide-react';
import UserAvatar from '@/components/ui/UserAvatar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { signOutAction } from '@/lib/actions/auth';

export default function AdminAccountMenu({
  fullName,
  email,
  role,
  unsentSales,
  onBeforeLogout,
}: {
  fullName: string;
  email: string | null;
  role?: string | null;
  unsentSales: number;
  onBeforeLogout: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const accountHref = `/account/settings?from=${encodeURIComponent(pathname ?? '/admin/dashboard')}`;
  const roleLabel = role === 'admin' ? 'Administrator' : 'Staff';

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-label="Account menu"
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex items-center gap-2 rounded-full p-1 text-left hover:bg-surface-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
        >
          <UserAvatar fullName={fullName} className="h-9 w-9 shrink-0 text-sm" asLink={false} />
          <span className="hidden min-w-0 sm:block">
            <span className="block max-w-36 truncate text-sm font-medium leading-tight text-ink">{fullName}</span>
            <span className="block text-xs leading-tight text-ink-muted">{roleLabel}</span>
          </span>
          <ChevronDown size={16} aria-hidden="true" className="hidden text-ink-muted sm:block" />
        </button>

        {open && (
          <div
            role="menu"
            aria-label="Account options"
            className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border-beige bg-surface-card shadow-xl"
          >
            <div className="border-b border-border-beige px-5 py-4">
              <p className="truncate text-sm font-semibold text-ink">{fullName}</p>
              {email && <p className="mt-0.5 truncate text-sm text-ink-muted">{email}</p>}
              <p className="mt-1 text-xs text-ink-muted">{roleLabel}</p>
            </div>

            <nav className="p-2">
              <Link
                href={`${accountHref}#profile`}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-ink-muted transition-colors hover:bg-brand-green hover:text-white focus-visible:outline-2 focus-visible:outline-brand-green"
              >
                <UserRound size={17} aria-hidden="true" className="text-current opacity-70" />
                My Profile
              </Link>
              <Link
                href={`${accountHref}#password`}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-ink-muted transition-colors hover:bg-brand-green hover:text-white focus-visible:outline-2 focus-visible:outline-brand-green"
              >
                <Settings size={17} aria-hidden="true" className="text-current opacity-70" />
                Account Settings
              </Link>
            </nav>

            <div className="border-t border-border-beige p-2">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  setConfirmingLogout(true);
                }}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-accent-terracotta hover:bg-accent-terracotta/5 focus-visible:outline-2 focus-visible:outline-accent-terracotta"
              >
                <LogOut size={17} aria-hidden="true" />
                Log out
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmingLogout}
        title={unsentSales > 0 ? 'Sales not sent yet' : 'Log out?'}
        message={
          unsentSales > 0
            ? `${unsentSales} counter ${unsentSales === 1 ? 'sale is' : 'sales are'} saved on this device but ${unsentSales === 1 ? 'has' : 'have'} not reached the shop system. They stay here and are sent when the internet is back and someone signs in on this device. Do not clear the browser data or switch devices before then.`
            : "You'll need to sign in again to access your account."
        }
        confirmLabel={unsentSales > 0 ? 'Log out anyway' : 'Log out'}
        cancelLabel="Cancel"
        onCancel={() => setConfirmingLogout(false)}
        onConfirm={async () => {
          await onBeforeLogout();
          await signOutAction();
        }}
      />
    </>
  );
}
