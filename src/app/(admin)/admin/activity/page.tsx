// STRAYMUTANT.DEV — Tamak Bookshop
import { createClient } from '@/lib/supabase/server';

const ACTION_LABELS: Record<string, string> = {
  vendor_credit_limit_set: 'Set vendor credit limit',
  vendor_status_change: 'Changed vendor status',
  admin_invited: 'Invited admin',
  admin_demoted: 'Demoted admin',
  staff_invited: 'Invited staff',
  staff_access_removed: 'Removed staff access',
  stock_intake: 'Stock intake',
  stock_writeoff: 'Stock write-off',
  order_status_updated: 'Updated order',
  pos_sale_created: 'POS sale',
  vendor_order_approved: 'Approved vendor order',
  vendor_order_rejected: 'Rejected vendor credit order',
  vendor_repayment_recorded: 'Recorded vendor repayment',
};

function labelFor(action: string) {
  return ACTION_LABELS[action] ?? action.replace(/_/g, ' ');
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ staff?: string; action?: string }>;
}) {
  const { staff: staffFilter, action: actionFilter } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from('audit_logs')
    .select('id, staff_id, action, entity_type, entity_id, details_json, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (staffFilter) query = query.eq('staff_id', staffFilter);
  if (actionFilter) query = query.eq('action', actionFilter);

  const { data: logs, error } = await query;

  const staffIds = Array.from(new Set((logs ?? []).map((l) => l.staff_id).filter(Boolean))) as string[];
  const namesById: Record<string, string> = {};
  if (staffIds.length > 0) {
    const { data: people } = await supabase.from('profiles').select('id, full_name').in('id', staffIds);
    for (const person of people ?? []) namesById[person.id] = person.full_name ?? 'Unknown';
  }

  const { data: allStaff } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('role', ['admin', 'staff'])
    .order('full_name');

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold text-ink">Activity log</h1>
      <p className="mb-6 text-sm text-ink-muted">Every tracked action across the platform, most recent first.</p>

      <form className="mb-6 flex flex-wrap gap-3 text-sm" method="get">
        <select name="staff" defaultValue={staffFilter ?? ''} className="rounded-md border border-brand-sage px-3 py-2">
          <option value="">All staff & admins</option>
          {(allStaff ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </select>

        <select name="action" defaultValue={actionFilter ?? ''} className="rounded-md border border-brand-sage px-3 py-2">
          <option value="">All actions</option>
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <button type="submit" className="rounded-md bg-brand-green px-4 py-2 text-white">
          Filter
        </button>
        {(staffFilter || actionFilter) && (
          <a href="/admin/activity" className="rounded-md border border-border-beige px-4 py-2 text-ink-muted">
            Clear
          </a>
        )}
      </form>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load activity: {error.message}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {(logs ?? []).map((log) => (
          <div key={log.id} className="rounded-md border border-border-beige bg-surface-card p-4 text-sm">
            <div className="flex justify-between">
              <span className="font-medium text-ink">{labelFor(log.action)}</span>
              <span className="text-xs text-ink-muted">{new Date(log.created_at).toLocaleString()}</span>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              {log.staff_id ? namesById[log.staff_id] ?? 'Unknown' : 'System'} · {log.entity_type}
            </p>
          </div>
        ))}
        {(logs ?? []).length === 0 && !error && (
          <p className="text-sm text-ink-muted">No activity recorded yet.</p>
        )}
      </div>
    </div>
  );
}