// STRAYMUTANT.DEV — Tamak Bookshop

// Shown while the inventory page is first loading.
export default function InventoryLoading() {
  return (
    <div aria-busy="true" aria-label="Loading inventory">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold text-ink">Inventory</h1>
        <span className="h-4 w-16 animate-pulse rounded bg-border-beige" />
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className="h-10 w-36 animate-pulse rounded-md bg-border-beige" />
        ))}
      </div>

      <div className="overflow-hidden rounded-md border border-border-beige bg-surface-card">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-t border-border-beige px-4 py-3 first:border-t-0">
            <span className="h-12 w-9 animate-pulse rounded bg-border-beige" />
            <span className="h-4 w-48 animate-pulse rounded bg-border-beige" />
            <span className="ml-auto h-4 w-24 animate-pulse rounded bg-border-beige" />
          </div>
        ))}
      </div>
    </div>
  );
}