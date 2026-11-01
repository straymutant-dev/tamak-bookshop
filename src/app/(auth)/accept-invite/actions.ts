// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { redirect } from 'next/navigation';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

export async function setPassword(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (password.length < 8) {
    redirect(`/accept-invite?error=${encodeURIComponent('Password must be at least 8 characters.')}`);
  }
  if (password !== confirm) {
    redirect(`/accept-invite?error=${encodeURIComponent('Passwords do not match.')}`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/invite-expired');

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`/accept-invite?error=${encodeURIComponent(error.message)}`);
  }

  // The database blocks logged-in users from editing invite_accepted_at,
  // so this one update must go through the service role.
  const service = createServiceRoleClient();
  const now = new Date().toISOString();
  const { error: profileError, data: profile } = await service
    .from('profiles')
    .update({ invite_accepted_at: now, last_login_at: now })
    .eq('id', user.id)
    .select('role')
    .single();

  if (profileError) redirect(`/accept-invite?error=${encodeURIComponent(profileError.message)}`);

  if (profile.role === 'vendor') {
    redirect(`/vendor/dashboard?toast=${encodeURIComponent('Welcome to Tamak Bookshop!')}`);
  }
  if (profile.role === 'client') {
    redirect(`/account/dashboard?toast=${encodeURIComponent('Welcome to Tamak Bookshop!')}`);
  }
  redirect(`/admin/dashboard?toast=${encodeURIComponent('Welcome to the team!')}`);
}