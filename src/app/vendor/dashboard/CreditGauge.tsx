// STRAYMUTANT.DEV — Tamak Bookshop
import Link from 'next/link';
import { formatGHS } from '@/lib/currency';

const RADIUS = 90;
const HALF_CIRCUMFERENCE = Math.PI * RADIUS;

/** A half-circle gauge of how much of the vendor's credit limit is in use, with the three figures under it. */
export default function CreditGauge({
  limitPesewas,
  usedPesewas,
  availablePesewas,
  canPay,
}: {
  limitPesewas: number;
  usedPesewas: number;
  availablePesewas: number;
  canPay: boolean;
}) {
  const pct = limitPesewas > 0 ? Math.min(100, Math.round((usedPesewas / limitPesewas) * 100)) : 0;
  const tight = pct >= 90;

  return (
    <div className="mb-8 rounded-2xl border border-border-beige bg-surface-card p-6">
      <h2 className="mb-2 font-serif text-xl text-brand-green">Your credit account</h2>

      <svg
        viewBox="0 0 220 125"
        className="mx-auto w-full max-w-70"
        role="img"
        aria-label={`${pct}% of your credit limit is in use`}
      >
        <path
          d="M20 110A90 90 0 0 1 200 110"
          fill="none"
          stroke="currentColor"
          strokeWidth="16"
          strokeLinecap="round"
          className="text-border-beige"
        />
        {pct > 0 && (
          <path
            d="M20 110A90 90 0 0 1 200 110"
            fill="none"
            stroke="currentColor"
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={`${(HALF_CIRCUMFERENCE * pct) / 100} ${HALF_CIRCUMFERENCE}`}
            className={tight ? 'text-accent-terracotta' : 'text-brand-green'}
          />
        )}
        <text
          x="110"
          y="88"
          textAnchor="middle"
          fontSize="34"
          className={`font-serif ${tight ? 'fill-accent-terracotta' : 'fill-brand-green'}`}
        >
          {pct}%
        </text>
        <text x="110" y="108" textAnchor="middle" fontSize="11" className="fill-ink-muted">
          of limit used
        </text>
      </svg>

      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-xs text-ink-muted">Limit</div>
          <div className="font-medium text-ink">{formatGHS(limitPesewas)}</div>
        </div>
        <div>
          <div className="text-xs text-ink-muted">Used</div>
          <div className="font-medium text-ink">{formatGHS(usedPesewas)}</div>
        </div>
        <div>
          <div className="text-xs text-ink-muted">Available</div>
          <div className="font-medium text-brand-green">{formatGHS(availablePesewas)}</div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {canPay && (
          <a href="#pay-balance" className="rounded-xl bg-brand-green px-5 py-2.5 text-sm font-medium text-white">
            Pay balance
          </a>
        )}
        <Link
          href="/store"
          className="rounded-xl border border-brand-green px-5 py-2.5 text-sm font-medium text-brand-green"
        >
          Order on credit
        </Link>
      </div>
    </div>
  );
}