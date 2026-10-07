// STRAYMUTANT.DEV — Tamak Bookshop
import Link from 'next/link';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  staff: 'Staff',
};

export default function AdminSessionBanner({ role, fullName }: { role: string; fullName: string | null }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 bg-ink px-4 py-2 text-center text-xs text-surface-cream sm:text-sm">
      <span>
        Logged in as {ROLE_LABELS[role] ?? role}
        {fullName ? `: ${fullName}` : ''}
      </span>
      <span aria-hidden="true">•</span>
      <Link href="/admin/inventory" className="font-medium underline hover:text-accent-gold">
        Return to Admin Portal
      </Link>
    </div>
  );
}