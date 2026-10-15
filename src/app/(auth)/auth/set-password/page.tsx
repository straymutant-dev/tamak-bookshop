// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import PasswordInput from '@/components/ui/PasswordInput';
import PasswordStrengthMeter from '@/components/ui/PasswordStrengthMeter';
import { normalizeGhanaPhone } from '@/lib/phone';

const DASHBOARD_BY_ROLE: Record<string, string> = {
  admin: '/admin/dashboard',
  staff: '/admin/dashboard',
  vendor: '/vendor/dashboard',
  client: '/account/dashboard',
};

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  staff: 'Staff',
  vendor: 'Vendor',
  client: 'Client',
};

export default function SetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReset = searchParams.get('mode') === 'reset';
  const [email, setEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [welcome, setWelcome] = useState<{ label: string; name: string; destination: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      // Phone accounts have no email: show the phone number instead.
      const phone = data.user?.phone ? (normalizeGhanaPhone(data.user.phone) ?? data.user.phone) : null;
      setEmail(data.user?.email || phone || null);
      setFullName((data.user?.user_metadata?.full_name as string) ?? null);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_super_admin, full_name')
      .eq('id', userData.user!.id)
      .single();

      await supabase.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', userData.user!.id);

    const role = profile?.role ?? 'client';
    const label = profile?.is_super_admin ? 'Super Admin' : ROLE_LABEL[role] ?? role;

    setWelcome({
      label,
      name: profile?.full_name ?? fullName ?? 'there',
      destination: DASHBOARD_BY_ROLE[role] ?? '/store',
    });
    setLoading(false);
  }

  if (welcome) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="mb-2 font-serif text-2xl text-ink">
          {isReset ? `Password updated, ${welcome.name}!` : `Welcome, ${welcome.label} ${welcome.name}!`}
        </h1>
        <p className="mb-8 text-sm text-ink-muted">
          {isReset ? 'You can now continue to your account.' : 'Your account is ready.'}
        </p>

        <button
          onClick={() => router.push(welcome.destination)}
          className="rounded-md bg-brand-green px-6 py-3 text-sm font-medium text-white"
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col justify-center px-6 py-16">
      <h1 className="mb-1 text-2xl font-semibold text-ink">{isReset ? 'Choose a new password' : 'Set your password'}</h1>
      <p className="mb-6 text-sm text-ink-muted">
        {isReset
          ? 'Enter a new password for your account below.'
          : `${fullName ? `Welcome, ${fullName}.` : 'Welcome.'} Choose a password to finish setting up your account.`}
      </p>

      <div className="mb-6 rounded-md border border-border-beige bg-surface-cream px-3 py-2 text-sm text-ink-muted">
        {email ?? 'Loading…'}
      </div>

      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Password
          <PasswordInput
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-brand-sage px-3 py-2"
          />
          <PasswordStrengthMeter password={password} />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Confirm password
          <PasswordInput
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="rounded-md border border-brand-sage px-3 py-2"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-md bg-brand-green px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Saving…' : isReset ? 'Update password' : 'Set password and continue'}
        </button>
      </form>
    </div>
  );
}