// STRAYMUTANT.DEV — Tamak Bookshop
export interface Stat {
  label: string;
  value: string | number;
  accent?: 'green' | 'gold' | 'terracotta';
}

const ACCENT_CLASS: Record<string, string> = {
  green: 'text-brand-green',
  gold: 'text-accent-gold',
  terracotta: 'text-accent-terracotta',
};

export default function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <div className="mb-8 flex flex-wrap gap-x-8 gap-y-4 border-b border-border-beige pb-6">
      {stats.map((stat) => (
        <div key={stat.label}>
          <div className={`text-2xl font-semibold ${stat.accent ? ACCENT_CLASS[stat.accent] : 'text-ink'}`}>
            {stat.value}
          </div>
          <div className="text-xs text-ink-muted">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}