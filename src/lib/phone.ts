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

/**
 * True when two phone numbers are the same number, however each was typed
 * ("024 123 4567" matches "+233241234567"). Falls back to an exact match when
 * either value isn't a valid Ghana number.
 */
export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const na = normalizeGhanaPhone(a);
  const nb = normalizeGhanaPhone(b);
  if (na && nb) return na === nb;
  return a.trim() === b.trim();
}

// Supabase needs +233XXXXXXXXX
export function toE164(input: string): string | null {
  const local = normalizeGhanaPhone(input);
  return local ? `+233${local.slice(1)}` : null;
}