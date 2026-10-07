// STRAYMUTANT.DEV — Tamak Bookshop
import { createClient } from '@/lib/supabase/server';
import StaffManager from './StaffManager';
import StatRow from '@/components/admin/StatRow';

export default async function StaffPage() {
  const supabase = await createClient();

  const { data: staff, error } = await supabase
    .from('profiles')
    .select('id, full_name, created_at')
    .eq('role', 'staff')
    .order('created_at', { ascending: true });

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-ink">Staff accounts</h1>
      <p className="mb-6 text-sm text-ink-muted">
        Invite staff by email, or remove access to move them back to a regular client account.
      </p>

      <StatRow stats={[{ label: 'Total staff', value: staff?.length ?? 0 }]} />

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load staff: {error.message}
        </p>
      )}

      <StaffManager staff={staff ?? []} />
    </div>
  );
}