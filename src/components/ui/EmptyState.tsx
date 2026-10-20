// STRAYMUTANT.DEV — Tamak Bookshop
import Link from 'next/link';
import type { ReactNode } from 'react';

/** One shared "nothing here yet" block: icon, title, a line of help and an optional button. */
export default function EmptyState({
  icon,
  title,
  body,
  actionHref,
  actionLabel,
  compact = false,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  actionHref?: string;
  actionLabel?: string;
  /** compact = no card, less padding; for use inside an existing panel */
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center text-center ${
        compact ? 'px-4 py-6' : 'rounded-2xl border border-border-beige bg-surface-card px-6 py-10'
      }`}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-green/10 text-brand-green">
        {icon}
      </div>
      <h2 className="font-serif text-xl text-brand-green">{title}</h2>
      {body && <p className="mt-2 max-w-xs text-sm text-ink-muted">{body}</p>}
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-5 rounded-xl bg-brand-green px-5 py-2.5 text-sm font-medium text-white"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}