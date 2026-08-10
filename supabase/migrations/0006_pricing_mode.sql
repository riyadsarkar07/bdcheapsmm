-- ---------------------------------------------------------------------
-- 0006 - Pricing mode + global profit
-- Additive migration: adds a pricing_mode column to services.
--   'global' = price follows Global Profit % (recomputed on apply/sync)
--   'custom' = price is set manually and never touched by global profit/sync
-- Run in Supabase SQL editor. Do not re-run after it succeeds.
-- ---------------------------------------------------------------------

alter table public.services
  add column if not exists pricing_mode text not null default 'global';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'services_pricing_mode_check'
      and conrelid = 'public.services'::regclass
  ) then
    alter table public.services
      add constraint services_pricing_mode_check
      check (pricing_mode in ('global', 'custom'));
  end if;
end $$;

-- New audit log actions for user suspension/reactivation.
do $$
begin
  if not exists (select 1 from pg_enum where enumlabel = 'suspend' and enumtypid = 'public.log_action'::regtype) then
    alter type public.log_action add value 'suspend';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'unsuspend' and enumtypid = 'public.log_action'::regtype) then
    alter type public.log_action add value 'unsuspend';
  end if;
end $$;
