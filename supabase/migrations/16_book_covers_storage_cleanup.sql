-- STRAYMUTANT.DEV — Tamak Bookshop
-- Removes: (1) a wide-open debug policy that currently lets ANY
-- authenticated user — not just admins — upload to book-covers, and
-- (2) leftover duplicate policies created directly via Studio's UI at
-- some point, using the old inline-subquery pattern, that were never
-- actually created by migrations 09/10 despite sharing similar intent.
-- After this, only the is_admin()-based policies from migration 15
-- remain on this bucket.

drop policy if exists "TEMP debug allow all authenticated" on storage.objects;
drop policy if exists "Allow admin uploads to book-covers" on storage.objects;
drop policy if exists "Allow admin update book-covers" on storage.objects;