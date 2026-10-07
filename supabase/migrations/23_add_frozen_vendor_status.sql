-- STRAYMUTANT.DEV — Tamak Bookshop
-- The app freezes vendors (VendorRow.tsx), but the enum never had 'frozen'.
-- Own migration file: Postgres won't reliably add and use an enum value in one transaction.
alter type public.vendor_approval add value if not exists 'frozen';