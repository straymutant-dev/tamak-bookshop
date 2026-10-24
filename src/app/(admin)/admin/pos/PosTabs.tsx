// STRAYMUTANT.DEV — Tamak Bookshop
import Link from 'next/link';

export default function PosTabs({ active }: { active: 'retail' | 'vendor' }) {
  const tabClass = (isActive: boolean) =>
    `rounded-xl px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green ${
      isActive ? 'bg-brand-green font-medium text-white shadow-sm' : 'text-ink-muted hover:bg-brand-green hover:text-white'
    }`;

  return (
    <nav aria-label="Point of sale" className="mb-6 flex gap-1">
      <Link href="/admin/pos" aria-current={active === 'retail' ? 'page' : undefined} className={tabClass(active === 'retail')}>
        Retail sale
      </Link>
      <Link href="/admin/pos/vendor" aria-current={active === 'vendor' ? 'page' : undefined} className={tabClass(active === 'vendor')}>
        Vendor sale
      </Link>
    </nav>
  );
}