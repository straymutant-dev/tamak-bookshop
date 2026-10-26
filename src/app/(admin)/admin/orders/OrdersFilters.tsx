// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminFilterDropdown from '@/components/admin/AdminFilterDropdown';
import AdminDatePicker from '@/components/admin/AdminDatePicker';

interface Option {
  value: string;
  label: string;
}

/**
 * Search and filters for All orders. There is no Search button: results update
 * as you type (after a short pause) and as soon as you change a date or a menu.
 */
export default function OrdersFilters({
  initial,
  typeOptions,
  statusOptions,
}: {
  initial: { q: string; from: string; to: string; type: string; status: string };
  typeOptions: Option[];
  statusOptions: Option[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initial.q);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [type, setType] = useState(initial.type);
  const [status, setStatus] = useState(initial.status);
  const [isPending, startTransition] = useTransition();
  const firstRun = useRef(true);
  const keepUnpaidTab = searchParams.get('tab') === 'unpaid';

  useEffect(() => {
    // Don't re-navigate on the first render.
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const sp = new URLSearchParams();
      if (q.trim()) sp.set('q', q.trim());
      if (from) sp.set('from', from);
      if (to) sp.set('to', to);
      if (type) sp.set('type', type);
      if (status) sp.set('status', status);
      if (keepUnpaidTab) sp.set('tab', 'unpaid');
      const qs = sp.toString();
      startTransition(() => {
        router.replace(`/admin/orders${qs ? `?${qs}` : ''}`, { scroll: false });
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [q, from, to, type, status, router, keepUnpaidTab]);

  const hasFilters = Boolean(q || from || to || type || status);
  const fieldClass = 'orders-filters__field';

  function clearAll() {
    setQ('');
    setFrom('');
    setTo('');
    setType('');
    setStatus('');
  }

  return (
    <div className="orders-filters mb-6">
      <label className="orders-filters__label">
        Search
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Order no., customer or phone"
          className={fieldClass}
          autoComplete="off"
        />
      </label>
      <label className="orders-filters__label">
        From
        <AdminDatePicker value={from} onChange={setFrom} placeholder="Any date" className="admin-date-picker--orders" />
      </label>
      <label className="orders-filters__label">
        To
        <AdminDatePicker value={to} onChange={setTo} placeholder="Any date" className="admin-date-picker--orders" />
      </label>
      <label className="orders-filters__label">
        Type
        <AdminFilterDropdown
          label="Filter by order type"
          options={[{ value: '', label: 'All types' }, ...typeOptions]}
          value={type}
          onChange={setType}
          className="admin-filter-dropdown--orders"
        />
      </label>
      <label className="orders-filters__label">
        Payment
        <AdminFilterDropdown
          label="Filter by payment status"
          options={[{ value: '', label: 'Any payment status' }, ...statusOptions]}
          value={status}
          onChange={setStatus}
          className="admin-filter-dropdown--orders"
        />
      </label>
      {(hasFilters || isPending) && (
        <div className="orders-filters__actions">
          {hasFilters && (
            <button type="button" onClick={clearAll} className="text-sm text-brand-green hover:underline">
              Clear
            </button>
          )}
          {isPending && <span className="text-xs text-ink-muted">Searching…</span>}
        </div>
      )}
    </div>
  );
}