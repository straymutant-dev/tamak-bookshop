// STRAYMUTANT.DEV — Tamak Bookshop
import Link from 'next/link';

export default function PosTabs({ active }: { active: 'retail' | 'vendor' }) {
  const tabClass = (isActive: boolean) =>
    `border-b-2 px-4 py-2 text-sm ${
      isActive ? 'border-brand-green font-medium text-brand-green' : 'border-transparent text-ink-muted hover:text-ink'
    }`;

  return (
    <div className="mb-6 flex gap-2 border-b border-border-beige">
      <Link href="/admin/pos" className={tabClass(active === 'retail')}>
        Retail sale
      </Link>
      <Link href="/admin/pos/vendor" className={tabClass(active === 'vendor')}>
        Vendor sale
      </Link>
    </div>
  );
}