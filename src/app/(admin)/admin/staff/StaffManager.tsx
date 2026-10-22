// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState, useTransition } from 'react';
import UserAvatar from '@/components/ui/UserAvatar';
import { inviteStaff, removeStaffAccess } from './actions';
import { useToast } from '@/components/ui/ToastContext';
import { useConfirm } from '@/components/ui/ConfirmContext';

interface StaffRow {
  id: string;
  full_name: string | null;
  created_at: string;
}

export default function StaffManager({ staff }: { staff: StaffRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);
  const { showToast } = useToast();
  const confirm = useConfirm();

  function handleInvite(formData: FormData) {
    setError(null);
    setInviteSent(false);
    startTransition(async () => {
      try {
        await inviteStaff(formData);
        showToast('Staff invite sent');
        setInviteSent(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to send invite');
      }
    });
  }

  async function handleRemove(userId: string) {
    setError(null);
    const ok = await confirm({
      title: 'Remove staff access?',
      message: 'They will become a regular client account and lose access to the staff portal.',
      confirmLabel: 'Remove access',
    });
    if (!ok) return;
    const formData = new FormData();
    formData.set('userId', userId);
    startTransition(async () => {
      try {
        await removeStaffAccess(formData);
        showToast('Staff access removed');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to remove access');
      }
    });
  }

  return (
    <div>
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

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
          placeholder="new-staff@example.com"
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

      {inviteSent && (
        <p className="mb-6 rounded-md bg-brand-green/10 px-3 py-2 text-sm text-brand-green">
          Invite sent — they&rsquo;ll get an email to set a password and sign in as staff.
        </p>
      )}

      <div className="overflow-hidden rounded-md border border-border-beige bg-surface-card">
        {staff.map((person, i) => (
          <div
            key={person.id}
            className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-border-beige' : ''}`}
          >
            <div className="flex items-center gap-3">
              <UserAvatar fullName={person.full_name} className="h-9 w-9 text-sm" asLink={false} />
              <div>
                <div className="text-sm font-medium text-ink">{person.full_name ?? '—'}</div>
                <div className="text-xs text-ink-muted">
                  Joined {new Date(person.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
            <button onClick={() => handleRemove(person.id)} className="text-xs text-accent-terracotta">
              Remove access
            </button>
          </div>
        ))}

        {staff.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-ink-muted">No staff accounts yet.</div>
        )}
      </div>
    </div>
  );
}