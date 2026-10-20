// STRAYMUTANT.DEV — Tamak Bookshop
import type { ReactNode } from 'react';

export interface Stat {
  label: string;
  value: string | number;
  accent?: 'green' | 'gold' | 'terracotta';
  /** optional icon shown in a small circle above the value */
  icon?: ReactNode;
}

const ACCENT_CLASS: Record<string, string> = {
  green: 'text-brand-green',
  gold: 'text-accent-gold',
  terracotta: 'text-accent-terracotta',
};

const ICON_BG: Record<string, string> = {
  green: 'bg-brand-green/10 text-brand-green',
  gold: 'bg-accent-gold/15 text-accent-gold',
  terracotta: 'bg-accent-terracotta/10 text-accent-terracotta',
};

export default function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {stats.map((stat) => {
        const long = typeof stat.value === 'string' && stat.value.length > 12;
        return (
          <div key={stat.label} className="rounded-2xl border border-border-beige bg-surface-card p-4">
            {stat.icon && (
              <div
                className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full ${
                  stat.accent ? ICON_BG[stat.accent] : 'bg-brand-green/10 text-brand-green'
                }`}
              >
                {stat.icon}
              </div>
            )}
            <div
            className={`wrap-break-word font-serif font-semibold ${long ? 'text-lg' : 'text-2xl'} ${
                stat.accent ? ACCENT_CLASS[stat.accent] : 'text-ink'
              }`}
            >
              {stat.value}
            </div>
            <div className="mt-0.5 text-xs text-ink-muted">{stat.label}</div>
          </div>
        );
      })}
    </div>
  );
}