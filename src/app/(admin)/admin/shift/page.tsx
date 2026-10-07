// STRAYMUTANT.DEV — Tamak Bookshop
import { createClient } from '@/lib/supabase/server';
import { formatGHS } from '@/lib/currency';
import ShiftClient from './ShiftClient';

export default async function ShiftPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: openShift } = user
    ? await supabase
        .from('cashier_shifts')
        .select('id, opened_at, opening_cash_pesewas')
        .eq('staff_id', user.id)
        .is('closed_at', null)
        .maybeSingle()
    : { data: null };

  const { data: recentShifts, error } = await supabase
    .from('cashier_shifts')
    .select(
      'id, staff_id, opened_at, closed_at, opening_cash_pesewas, actual_closing_cash_pesewas, expected_cash_pesewas, shift_discrepancy_pesewas'
    )
    .not('closed_at', 'is', null)
    .order('closed_at', { ascending: false })
    .limit(30);

  const staffIds = Array.from(new Set((recentShifts ?? []).map((s) => s.staff_id).filter(Boolean))) as string[];
  const namesById: Record<string, string> = {};
  if (staffIds.length > 0) {
    const { data: people } = await supabase.from('profiles').select('id, full_name').in('id', staffIds);
    for (const p of people ?? []) namesById[p.id] = p.full_name ?? 'Unknown';
  }

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold text-ink">Cashier shift</h1>
      <p className="mb-6 text-sm text-ink-muted">Open a shift when you start on the till, close it when you&rsquo;re done.</p>

      <ShiftClient openShift={openShift} />

      <h2 className="mb-3 mt-10 text-lg font-semibold text-ink">Recent shifts</h2>
      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load shift history: {error.message}
        </p>
      )}
      <div className="overflow-x-auto rounded-md border border-border-beige bg-surface-card">
        <table className="w-full text-sm">
          <thead className="bg-surface-cream text-left text-ink-muted">
            <tr>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Opened</th>
              <th className="px-4 py-3">Closed</th>
              <th className="px-4 py-3">Expected cash</th>
              <th className="px-4 py-3">Actual cash</th>
              <th className="px-4 py-3">Discrepancy</th>
            </tr>
          </thead>
          <tbody>
            {(recentShifts ?? []).map((s) => (
              <tr key={s.id} className="border-t border-border-beige">
                <td className="px-4 py-3 text-ink">{s.staff_id ? namesById[s.staff_id] ?? 'Staff' : '—'}</td>
                <td className="px-4 py-3 text-xs text-ink-muted">{new Date(s.opened_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-xs text-ink-muted">
                  {s.closed_at ? new Date(s.closed_at).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3 text-ink-muted">{formatGHS(s.expected_cash_pesewas ?? 0)}</td>
                <td className="px-4 py-3 text-ink-muted">{formatGHS(s.actual_closing_cash_pesewas ?? 0)}</td>
                <td
                  className={`px-4 py-3 font-medium ${
                    (s.shift_discrepancy_pesewas ?? 0) === 0
                      ? 'text-ink-muted'
                      : (s.shift_discrepancy_pesewas ?? 0) > 0
                        ? 'text-brand-green'
                        : 'text-accent-terracotta'
                  }`}
                >
                  {(s.shift_discrepancy_pesewas ?? 0) > 0 ? '+' : ''}
                  {formatGHS(s.shift_discrepancy_pesewas ?? 0)}
                </td>
              </tr>
            ))}
            {(recentShifts ?? []).length === 0 && !error && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-muted">
                  No completed shifts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}