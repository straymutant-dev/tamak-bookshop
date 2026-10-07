// STRAYMUTANT.DEV — Tamak Bookshop
import Link from 'next/link';

function getInitials(fullName: string | null): string {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  const initials = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
  return initials || '?';
}

export default function UserAvatar({
  fullName,
  className = 'h-9 w-9 text-sm',
  href = '/account/settings',
  asLink = true,
}: {
  fullName: string | null;
  className?: string;
  href?: string;
  asLink?: boolean;
}) {
  const initials = getInitials(fullName);
  const classes = `flex items-center justify-center rounded-full bg-brand-green font-medium text-white ${className}`;

  if (!asLink) {
    return <span className={classes}>{initials}</span>;
  }

  return (
    <Link href={href} aria-label="Account settings" className={classes}>
      {initials}
    </Link>
  );
}