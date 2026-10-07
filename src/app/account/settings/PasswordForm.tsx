// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState, useTransition } from 'react';
import PasswordInput from '@/components/ui/PasswordInput';
import { updatePassword } from './actions';

export default function PasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updatePassword(formData);
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update password');
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && <p className="rounded-md bg-brand-green/10 px-3 py-2 text-sm text-brand-green">Password updated.</p>}

      <label className="flex flex-col gap-1 text-sm">
        Current password
        <PasswordInput name="currentPassword" required className="rounded-md border border-brand-sage px-3 py-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        New password
        <PasswordInput name="newPassword" required minLength={8} className="rounded-md border border-brand-sage px-3 py-2" />
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="mt-1 self-start rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? 'Updating…' : 'Update password'}
      </button>
    </form>
  );
}