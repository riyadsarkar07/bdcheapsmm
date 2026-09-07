-- Preserve actual provider cost on new orders.
-- charge previously defaulted to 0 (numeric 12,2), which made admin profit
-- look like 100% whenever cost was never written. Widen precision so costs
-- such as 0.528 are stored exactly. Do not rewrite existing rows.

alter table public.orders
  alter column charge type numeric(12, 6)
  using charge;

alter table public.orders
  alter column charge set default null;
