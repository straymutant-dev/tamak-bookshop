// STRAYMUTANT.DEV — Tamak Bookshop

/**
 * Validates a Ghana phone number and returns it in local 10-digit form
 * (0241234567), or null if it isn't valid.
 * Accepts: 024 123 4567, 0241234567, +233 24 123 4567, 233241234567.
 */
export function normalizeGhanaPhone(input: string): string | null {
  const cleaned = input.replace(/[\s\-().]/g, '');
  const match = cleaned.match(/^(?:\+233|233|0)([235]\d{8})$/);
  return match ? `0${match[1]}` : null;
}