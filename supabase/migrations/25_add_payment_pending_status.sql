-- STRAYMUTANT.DEV — Tamak Bookshop
-- A vendor order paid by cash / mobile money / bank / cheque is not "paid"
-- until staff confirm the money arrived. This adds the status for
-- "ordered, waiting for payment confirmation".
-- Own migration file: Postgres won't reliably let you add an enum value and
-- use it in the same transaction (same reason as 17).
alter type public.pay_status add value if not exists 'payment_pending';