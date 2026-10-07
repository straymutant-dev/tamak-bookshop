// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

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
  const [q, setQ] = useState(initial.q);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [type, setType] = useState(initial.type);
  const [status, setStatus] = useState(initial.status);
  const [isPending, startTransition] = useTransition();
  const firstRun = useRef(true);

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
      const qs = sp.toString();
      startTransition(() => {
        router.replace(`/admin/orders${qs ? `?${qs}` : ''}`, { scroll: false });
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [q, from, to, type, status, router]);

  const hasFilters = Boolean(q || from || to || type || status);
  const fieldClass = 'rounded-md border border-brand-sage px-3 py-2 text-sm text-ink';

  function clearAll() {
    setQ('');
    setFrom('');
    setTo('');
    setType('');
    setStatus('');
  }

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs text-ink-muted">
        Search
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Order number, customer name or phone"
          className={fieldClass}
          autoComplete="off"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        From
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        To
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        Type
        <select value={type} onChange={(e) => setType(e.target.value)} className={fieldClass}>
          <option value="">All</option>
          {typeOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        Payment
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={fieldClass}>
          <option value="">Any</option>
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {hasFilters && (
        <button type="button" onClick={clearAll} className="py-2 text-sm text-brand-green hover:underline">
          Clear
        </button>
      )}
      {isPending && <span className="py-2 text-xs text-ink-muted">Searching…</span>}
    </div>
  );
}