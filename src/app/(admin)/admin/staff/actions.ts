// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

async function currentOrigin() {
  const host = (await headers()).get('host') ?? '';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') throw new Error('Only admins can manage staff accounts');
  return user.id;
}

export async function inviteStaff(formData: FormData) {
  const adminId = await assertAdmin();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const fullName = String(formData.get('fullName') ?? '').trim();
  if (!email) throw new Error('Email is required');
  if (!fullName) throw new Error('Full name is required');

  const service = createServiceRoleClient();

  const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
    data: { role: 'staff', full_name: fullName },
    redirectTo: `${await currentOrigin()}/auth/confirm`
  });

  if (error) throw new Error(error.message);

    if (!data.user?.id) throw new Error('Invite sent but no user was returned');
  const { error: roleError } = await service
    .from('profiles')
    .update({ role: 'staff' })
    .eq('id', data.user.id);
  if (roleError) throw new Error(`Invite sent but role could not be set: ${roleError.message}`);

  const { error: auditError } = await service.from('audit_logs').insert({
    staff_id: adminId,
    action: 'staff_invited',
    entity_type: 'profiles',
    entity_id: data.user?.id ?? null,
    details_json: { email },
  });
  if (auditError) console.error('audit log insert failed:', auditError.message);

  revalidatePath('/admin/staff');
}

export async function removeStaffAccess(formData: FormData) {
  const adminId = await assertAdmin();
  const targetId = String(formData.get('userId') ?? '');
  if (!targetId) throw new Error('Missing user');
  if (targetId === adminId) throw new Error("You can't remove your own access here");

  const service = createServiceRoleClient();

  const { error } = await service.from('profiles').update({ role: 'client' }).eq('id', targetId);
  if (error) throw new Error(error.message);

  const { error: auditError } = await service.from('audit_logs').insert({
    staff_id: adminId,
    action: 'staff_access_removed',
    entity_type: 'profiles',
    entity_id: targetId,
    details_json: {},
  });
  if (auditError) console.error('audit log insert failed:', auditError.message);

  revalidatePath('/admin/staff');
}