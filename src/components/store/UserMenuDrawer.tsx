// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';import MobileDrawer from '@/components/ui/MobileDrawer';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import UserAvatar from '@/components/ui/UserAvatar';
import { signOutAction } from '@/lib/actions/auth';

export interface UserMenuItem {
  label: string;
  href: string;
}

export default function UserMenuDrawer({
  open,
  onClose,
  fullName,
  extraItems = [],
}: {
  open: boolean;
  onClose: () => void;
  fullName: string | null;
  extraItems?: UserMenuItem[];
}) {
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <MobileDrawer open={open} onClose={onClose} restrictToMobile={false}>
        <div className="mb-6 flex items-center gap-3">
          <UserAvatar fullName={fullName} className="h-10 w-10" asLink={false} />
          <span className="text-sm font-medium text-ink">{fullName}</span>
        </div>

        <nav className="flex flex-col gap-1 text-sm text-ink">
          {extraItems.map((item) => (
            <Link key={item.href} href={item.href} className="py-2" onClick={onClose}>
              {item.label}
            </Link>
          ))}
          {extraItems.length > 0 && <div className="my-2 border-t border-border-beige" />}

          <Link href={`/account/settings?from=${encodeURIComponent(pathname)}`} className="py-2" onClick={onClose}>
            Account settings
          </Link>

          <div className="my-2 border-t border-border-beige" />

          <button onClick={() => setConfirmingLogout(true)} className="py-2 text-left text-accent-terracotta">
            Log out
          </button>
        </nav>
      </MobileDrawer>

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
    </>
  );
}