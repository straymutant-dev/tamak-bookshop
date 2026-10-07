// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState, useTransition } from 'react';
import UserAvatar from '@/components/ui/UserAvatar';
import { inviteAdmin, demoteAdmin } from './actions';
import { useToast } from '@/components/ui/ToastContext';

interface AdminRow {
  id: string;
  full_name: string | null;
  is_super_admin: boolean;
  created_at: string;
}

export default function TeamManager({
  admins,
  isSuperAdmin,
}: {
  admins: AdminRow[];
  isSuperAdmin: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);
  const { showToast } = useToast();

  function handleInvite(formData: FormData) {
    setError(null);
    setInviteSent(false);
    startTransition(async () => {
      try {
        await inviteAdmin(formData);
        setInviteSent(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to send invite');
      }
    });
  }

  function handleDemote(userId: string, newRole: string) {
    setError(null);
    if (!confirm(`Demote this admin to ${newRole}?`)) return;
    const formData = new FormData();
    formData.set('userId', userId);
    formData.set('newRole', newRole);
    startTransition(async () => {
      try {
        await demoteAdmin(formData);
        showToast(`Admin demoted to ${newRole}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to demote admin');
      }
    });
  }

  return (
    <div>
      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {isSuperAdmin && (
        <form action={handleInvite} className="mb-8 flex max-w-md flex-col gap-2 sm:flex-row">
          <input
            name="fullName"
            required
            placeholder="Full name"
            className="w-full rounded-md border border-brand-sage px-3 py-2 text-sm"
          />
          <input
            name="email"
            type="email"
            required
            placeholder="new-admin@example.com"
            className="w-full rounded-md border border-brand-sage px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={isPending}
            className="shrink-0 rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending ? 'Sending…' : 'Send invite'}
          </button>
        </form>
      )}

      {inviteSent && (
        <p className="mb-6 rounded-md bg-brand-green/10 px-3 py-2 text-sm text-brand-green">
          Invite sent — they&rsquo;ll get an email to set a password and sign in as admin.
        </p>
      )}

      <div className="overflow-hidden rounded-md border border-border-beige bg-surface-card">
        {admins.map((admin, i) => (
          <div
            key={admin.id}
            className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-border-beige' : ''}`}
          >
            <div className="flex items-center gap-3">
              <UserAvatar fullName={admin.full_name} className="h-9 w-9 text-sm" asLink={false} />
              <div>
                <div className="text-sm font-medium text-ink">{admin.full_name ?? '—'}</div>
                <div className="text-xs text-ink-muted">
                  Joined {new Date(admin.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {admin.is_super_admin ? (
                <span className="rounded-full bg-accent-gold/20 px-2 py-1 text-xs font-medium text-accent-gold">
                  Super admin
                </span>
              ) : (
                <span className="text-xs text-ink-muted">Admin</span>
              )}

              {isSuperAdmin && !admin.is_super_admin && (
                <div className="flex gap-3 text-xs">
                  <button onClick={() => handleDemote(admin.id, 'staff')} className="text-accent-terracotta">
                    Demote to staff
                  </button>
                  <button onClick={() => handleDemote(admin.id, 'client')} className="text-accent-terracotta">
                    Demote to client
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {admins.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-ink-muted">No admins yet.</div>
        )}
      </div>
    </div>
  );
}