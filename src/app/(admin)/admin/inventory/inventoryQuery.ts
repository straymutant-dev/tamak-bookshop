// STRAYMUTANT.DEV — Tamak Bookshop

// Shared by the inventory page (server) and table (browser): which columns can be
// sorted, how they map to database columns, and how many books show per page.

export const INVENTORY_PAGE_SIZE = 25;

export type InventorySortKey = 'title' | 'category' | 'retail' | 'wholesale' | 'stock';
export type SortDirection = 'asc' | 'desc';

export const SORT_COLUMNS = {
  title: 'title',
  category: 'category',
  retail: 'customer_price_pesewas',
  wholesale: 'vendor_price_pesewas',
  stock: 'stock_quantity',
} as const satisfies Record<InventorySortKey, string>;

export function parseSortKey(value: string | undefined): InventorySortKey {
  return value && value in SORT_COLUMNS ? (value as InventorySortKey) : 'title';
}

export function parseDirection(value: string | undefined): SortDirection {
  return value === 'desc' ? 'desc' : 'asc';
}