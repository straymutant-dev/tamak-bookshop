// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useRef, useState, useTransition } from 'react';
import PasswordInput from '@/components/ui/PasswordInput';
import { useToast } from '@/components/ui/ToastContext';
import { updatePassword } from './actions';
import HCaptcha, { HCAPTCHA_ENABLED } from '@/components/ui/HCaptcha';
import ProcessingButton from '@/components/ui/ProcessingButton';

export default function PasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [captchaToken, setCaptchaToken] = useState('');
  const { showToast } = useToast();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updatePassword(formData);
        showToast('Password updated');
        formRef.current?.reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update password');
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-3">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <label className="flex flex-col gap-1 text-sm">
        Current password
        <PasswordInput name="currentPassword" required className="rounded-md border border-brand-sage px-3 py-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        New password
        <PasswordInput name="newPassword" required minLength={8} className="rounded-md border border-brand-sage px-3 py-2" />
      </label>

      <HCaptcha onToken={setCaptchaToken} />

      <ProcessingButton
        type="submit"
        isProcessing={isPending}
        processingText="Updating…"
        disabled={HCAPTCHA_ENABLED && !captchaToken}
        className="mt-1 self-start rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Update password
      </ProcessingButton>
    </form>
  );
}