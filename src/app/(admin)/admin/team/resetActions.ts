// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

export async function resetLaunchProject(formData: FormData) {
  const confirmation = String(formData.get('confirmation') ?? '').trim();
  if (confirmation !== 'RESET PROJECT') throw new Error('Type RESET PROJECT exactly to continue');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: me } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single();
  if (!me?.is_super_admin) throw new Error('Only the super admin can reset the project');

  const service = createServiceRoleClient();
  const { data: removableProfiles, error: profileError } = await service
    .from('profiles')
    .select('id')
    .eq('is_super_admin', false);
  if (profileError) throw new Error(profileError.message);

  const removableIds = new Set((removableProfiles ?? []).map((profile) => profile.id));
  removableIds.delete(user.id);

  const rpcReset = supabase.rpc as unknown as (
    fn: string,
    args: { p_confirmation: string },
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  const { data: resetResult, error: resetError } = await rpcReset('reset_project_launch_data', {
    p_confirmation: confirmation,
  });
  if (resetError) throw new Error(resetError.message);

  let deletedAuthAccounts = 0;
  for (const id of removableIds) {
    const { error } = await service.auth.admin.deleteUser(id);
    if (error) console.error(`Failed to delete account ${id}:`, error.message);
    else deletedAuthAccounts += 1;
  }

  await clearBookCoverStorage(service);

  return {
    reset: resetResult as unknown,
    deletedAuthAccounts,
  };
}

async function clearBookCoverStorage(service: ReturnType<typeof createServiceRoleClient>) {
  const paths: string[] = [];

  async function visit(prefix = '') {
    const { data, error } = await service.storage.from('book-covers').list(prefix, {
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error(`Could not list cover images: ${error.message}`);

    for (const entry of data ?? []) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) paths.push(path);
      else await visit(path);
    }
  }

  await visit();
  if (paths.length > 0) {
    const { error } = await service.storage.from('book-covers').remove(paths);
    if (error) throw new Error(`Data reset succeeded but cover cleanup failed: ${error.message}`);
  }
}
