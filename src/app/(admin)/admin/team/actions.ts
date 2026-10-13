// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

async function assertSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_super_admin) throw new Error('Only the super admin can manage the admin team');
  return user.id;
}

export async function inviteAdmin(formData: FormData) {
  const actorId = await assertSuperAdmin();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const fullName = String(formData.get('fullName') ?? '').trim();
  if (!email) throw new Error('Email is required');
  if (!fullName) throw new Error('Full name is required');

  const service = createServiceRoleClient();

  const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
    data: { role: 'admin', full_name: fullName },
    redirectTo: `${origin}/auth/confirm`
  });
  
  if (error) throw new Error(error.message);

    if (!data.user?.id) throw new Error('Invite sent but no user was returned');
  const { error: roleError } = await service
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', data.user.id);
  if (roleError) throw new Error(`Invite sent but role could not be set: ${roleError.message}`);

  const { error: auditError } = await service.from('audit_logs').insert({
    staff_id: actorId,
    action: 'admin_invited',
    entity_type: 'profiles',
    entity_id: data.user?.id ?? null,
    details_json: { email },
  });
  if (auditError) console.error('audit log insert failed:', auditError.message);

  revalidatePath('/admin/team');
}

export async function demoteAdmin(formData: FormData) {
  const actorId = await assertSuperAdmin();
  const targetId = String(formData.get('userId') ?? '');
  const newRole = (['staff', 'vendor', 'client'] as const).find(
    (r) => r === (formData.get('newRole') ?? 'staff'),
  );

  if (!targetId) throw new Error('Missing user');
  if (targetId === actorId) {
    throw new Error("You can't demote your own account here — use the Supabase dashboard for that");
  }
  if (!newRole) {
    throw new Error('Invalid target role');
  }

  const service = createServiceRoleClient();

  const { data: target } = await service
    .from('profiles')
    .select('is_super_admin')
    .eq('id', targetId)
    .single();

  if (target?.is_super_admin) {
    throw new Error('Super admins can only be changed directly in the database');
  }

  const { error } = await service
    .from('profiles')
    .update({ role: newRole })
    .eq('id', targetId);

  if (error) throw new Error(error.message);

  const { error: auditError } = await service.from('audit_logs').insert({
    staff_id: actorId,
    action: 'admin_demoted',
    entity_type: 'profiles',
    entity_id: targetId,
    details_json: { new_role: newRole },
  });
  if (auditError) console.error('audit log insert failed:', auditError.message);

  revalidatePath('/admin/team');
}