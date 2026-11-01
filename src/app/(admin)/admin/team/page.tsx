// STRAYMUTANT.DEV — Tamak Bookshop
import { createClient } from '@/lib/supabase/server';
import TeamManager from './TeamManager';
import StatRow from '@/components/admin/StatRow';
import ResetProjectPanel from './ResetProjectPanel';

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user!.id)
    .single();

  const { data: admins, error } = await supabase
    .from('profiles')
    .select('id, full_name, is_super_admin, created_at')
    .eq('role', 'admin')
    .order('created_at', { ascending: true });

  const superAdminName = admins?.find((a) => a.is_super_admin)?.full_name ?? '—';

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-ink">Admin team</h1>
      <p className="mb-6 text-sm text-ink-muted">
        {me?.is_super_admin
          ? 'Invite new admins by email, or demote an existing one back to staff, vendor, or client.'
          : 'Only the super admin can invite or demote admins. You can view the current team below.'}
      </p>

      <StatRow
        stats={[
          { label: 'Total admins', value: admins?.length ?? 0 },
          { label: 'Super admin', value: superAdminName, accent: 'gold' },
        ]}
      />

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load admin team: {error.message}
        </p>
      )}

      <TeamManager admins={admins ?? []} isSuperAdmin={!!me?.is_super_admin} />
      {!!me?.is_super_admin && <ResetProjectPanel />}
    </div>
  );
}