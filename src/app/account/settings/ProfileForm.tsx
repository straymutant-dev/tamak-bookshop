// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useState, useTransition } from 'react';
import PasswordInput from '@/components/ui/PasswordInput';
import { updateProfile } from './actions';
import { useToast } from '@/components/ui/ToastContext';
import Turnstile, { TURNSTILE_ENABLED } from '@/components/ui/Turnstile';

export default function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const { showToast } = useToast();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updateProfile(formData);
        showToast('Profile updated');
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save');
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && <p className="rounded-md bg-brand-green/10 px-3 py-2 text-sm text-brand-green">Saved.</p>}

      <label className="flex flex-col gap-1 text-sm">
        Full name
        <input name="fullName" defaultValue={fullName} required className="rounded-md border border-brand-sage px-3 py-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Phone
        <input name="phone" type="tel" defaultValue={phone} className="rounded-md border border-brand-sage px-3 py-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Current password
        <PasswordInput name="currentPassword" required className="rounded-md border border-brand-sage px-3 py-2" />
      </label>

      <Turnstile onToken={setCaptchaToken} />

      <button
        type="submit"
        disabled={isPending || (TURNSTILE_ENABLED && !captchaToken)}
        className="mt-1 self-start rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}