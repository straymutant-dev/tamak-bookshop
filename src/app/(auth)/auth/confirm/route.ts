// STRAYMUTANT.DEV — Tamak Bookshop
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');

  // failures for invite links go to the invite page, not the customer login
  const failTo = (message: string) =>
    type === 'invite'
      ? NextResponse.redirect(`${origin}/invite-expired`)
      : NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(message)}`);

  if (!tokenHash || (type !== 'invite' && type !== 'signup' && type !== 'recovery')) {
    return failTo('Invalid or expired confirmation link');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as 'invite' | 'signup' | 'recovery',
  });

  if (error || !data.user) {
    return failTo(error?.message ?? 'Confirmation failed');
  }

  if (type === 'invite') {
    return NextResponse.redirect(`${origin}/accept-invite`);
  }

  if (type === 'recovery') {
    return NextResponse.redirect(`${origin}/auth/set-password?mode=reset`);
  }

  // type === 'signup': client or vendor confirming their own email.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, vendor_status')
    .eq('id', data.user.id)
    .single();

  await supabase
    .from('profiles')
    .update({
      last_login_at: new Date().toISOString(),
      ...(data.user.email ? { contact_email: data.user.email } : {}),
    })
    .eq('id', data.user.id);

  if (profile?.role === 'vendor') {
    const message =
      profile.vendor_status === 'approved'
        ? `Email confirmed, Welcome ${profile.full_name}!`
        : `Email verified — awaiting approval from the administrator of Tamak Bookshop.`;
    return NextResponse.redirect(`${origin}/vendor/dashboard?toast=${encodeURIComponent(message)}`);
  }

  const message = `Email confirmed, Welcome ${profile?.full_name ?? 'there'}!`;
  return NextResponse.redirect(`${origin}/account/dashboard?toast=${encodeURIComponent(message)}`);
}