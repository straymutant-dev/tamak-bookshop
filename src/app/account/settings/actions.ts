// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { parseEmail } from '@/lib/email';
import { CAPTCHA_MESSAGE, captchaTokenFrom, isCaptchaError } from '@/lib/captcha';

// Re-checks the current password. Email accounts sign in with their email, phone accounts with their phone.
function credentialsFor(user: User, password: string, captchaToken: string | undefined) {
  const options = { captchaToken };
  if (user.email) return { email: user.email, password, options };
  if (user.phone) return { phone: user.phone.startsWith('+') ? user.phone : `+${user.phone}`, password, options };
  return null;
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const currentPassword = String(formData.get('currentPassword') ?? '');
  const fullName = String(formData.get('fullName') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();

  if (!fullName) throw new Error('Full name is required');

  const credentials = credentialsFor(user, currentPassword, captchaTokenFrom(formData));
  if (!credentials) throw new Error('Not authenticated');
  const { error: verifyError } = await supabase.auth.signInWithPassword(credentials);
  if (verifyError) {
    throw new Error(isCaptchaError(verifyError.message) ? CAPTCHA_MESSAGE : 'Current password is incorrect');
  }

  // A phone account's number is its login, verified by SMS code, so it can't be edited here.
  // They can add or change the email their receipts go to (email accounts use their account email).
  const update = user.email
    ? { full_name: fullName, phone }
    : { full_name: fullName, contact_email: parseEmail(formData.get('contactEmail')) };
  const { error } = await supabase.from('profiles').update(update).eq('id', user.id);
  if (error) throw new Error(error.message);

  revalidatePath('/account/settings');
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  const currentPassword = String(formData.get('currentPassword') ?? '');
  const newPassword = String(formData.get('newPassword') ?? '');

  if (newPassword.length < 8) throw new Error('New password must be at least 8 characters');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Verify the current password by attempting a fresh sign-in with it,
  // rather than trusting the active session alone.
  const credentials = credentialsFor(user, currentPassword, captchaTokenFrom(formData));
  if (!credentials) throw new Error('Not authenticated');
  const { error: verifyError } = await supabase.auth.signInWithPassword(credentials);
  if (verifyError) {
    throw new Error(isCaptchaError(verifyError.message) ? CAPTCHA_MESSAGE : 'Current password is incorrect');
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/?toast=${encodeURIComponent('Signed out successfully')}`);
}

export async function deleteOwnAccount(formData: FormData) {
  const confirmation = String(formData.get('confirmation') ?? '').trim();
  if (confirmation !== 'DELETE ACCOUNT') throw new Error('Type DELETE ACCOUNT exactly to continue');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, outstanding_balance_pesewas')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'client' && profile?.role !== 'vendor') {
    throw new Error('Only client and vendor accounts can delete themselves here');
  }
  if (profile.role === 'vendor' && (profile.outstanding_balance_pesewas ?? 0) !== 0) {
    throw new Error('Delete blocked: pay off the outstanding vendor credit balance first');
  }
  if (profile.role === 'vendor') {
    const { data: pendingOrders } = await supabase
      .from('orders')
      .select('total_pesewas')
      .eq('user_id', user.id)
      .eq('payment_method', 'credit')
      .eq('payment_status', 'credit_pending');
    if ((pendingOrders ?? []).some((order) => (order.total_pesewas ?? 0) > 0)) {
      throw new Error('Delete blocked: resolve pending vendor credit orders first');
    }
  }

  const rpcDelete = supabase.rpc as unknown as (
    fn: string,
    args?: Record<string, never>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  const { error } = await rpcDelete('delete_own_account');
  if (error) throw new Error(error.message);

  const service = createServiceRoleClient();
  const { error: authError } = await service.auth.admin.deleteUser(user.id);
  if (authError) throw new Error(`Profile deleted but the sign-in could not be removed: ${authError.message}`);

  await supabase.auth.signOut();
  redirect(`/?toast=${encodeURIComponent('Your account has been deleted')}`);
}