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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_super_admin')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'admin') throw new Error('Only admins can manage staff accounts');
  return { userId: user.id, isSuperAdmin: profile.is_super_admin === true };
}

export async function inviteStaff(formData: FormData) {
  const { userId: adminId, isSuperAdmin } = await assertAdmin();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const fullName = String(formData.get('fullName') ?? '').trim();
  if (!email) throw new Error('Email is required');
  if (!fullName) throw new Error('Full name is required');
  const role = (['staff', 'admin', 'vendor', 'client'] as const).find(
    (value) => value === (formData.get('role') ?? 'staff'),
  );
  if (!role) throw new Error('Invalid invite role');
  if (role === 'admin' && !isSuperAdmin) {
    throw new Error('Only the super admin can invite administrators');
  }

  const service = createServiceRoleClient();

  const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
    data: { role, full_name: fullName },
    redirectTo: `${await currentOrigin()}/auth/confirm`
  });

  if (error) throw new Error(error.message);

    if (!data.user?.id) throw new Error('Invite sent but no user was returned');
  const { error: roleError } = await service
    .from('profiles')
    .update({
      role,
      ...(role === 'vendor' ? { vendor_status: 'pending' } : {}),
    })
    .eq('id', data.user.id);
  if (roleError) throw new Error(`Invite sent but role could not be set: ${roleError.message}`);

  const { error: auditError } = await service.from('audit_logs').insert({
    staff_id: adminId,
    action: 'staff_invited',
    entity_type: 'profiles',
    entity_id: data.user?.id ?? null,
    details_json: { email, role },
  });
  if (auditError) console.error('audit log insert failed:', auditError.message);

  revalidatePath('/admin/staff');
}

export async function removeStaffAccess(formData: FormData) {
  const { userId: adminId } = await assertAdmin();
  const targetId = String(formData.get('userId') ?? '');
  if (!targetId) throw new Error('Missing user');
  if (targetId === adminId) throw new Error("You can't remove your own access here");

  const service = createServiceRoleClient();

  const { data: target, error: targetError } = await service
    .from('profiles')
    .select('role, is_super_admin')
    .eq('id', targetId)
    .single();

  if (targetError || !target) throw new Error('Staff account not found');
  if (target.is_super_admin) throw new Error('Super admins cannot be changed here');
  if (target.role !== 'staff') throw new Error('Only staff accounts can have access removed here');

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