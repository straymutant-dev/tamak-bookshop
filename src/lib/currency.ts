// STRAYMUTANT.DEV — Tamak Bookshop

/** Convert integer pesewas to a GHS float (e.g. 2550 -> 25.5) */
export function pesewasToGHS(pesewas: number): number {
  return Math.round(pesewas) / 100;
}

/** Convert a GHS float to integer pesewas (e.g. 25.5 -> 2550) */
export function ghsToPesewas(ghs: number): number {
  return Math.round(ghs * 100);
}

/** Format integer pesewas as a "GH₵ 25.50" display string */
export function formatGHS(pesewas: number): string {
  const amount = pesewasToGHS(pesewas);
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Safe addition of two pesewas integers */
export function addPesewas(a: number, b: number): number {
  return Math.round(a) + Math.round(b);
}

/** Multiply a pesewas amount by a quantity, staying in integer pesewas */
export function multiplyPesewas(pesewas: number, quantity: number): number {
  return Math.round(pesewas * quantity);
}