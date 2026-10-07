-- STRAYMUTANT.DEV — Tamak Bookshop
-- Adds "cheque" as a payment method option. Must be its own migration,
-- separate from anything that uses the new value, since Postgres won't
-- reliably let you add an enum value and use it in the same transaction.

alter type pay_method add value if not exists 'cheque';