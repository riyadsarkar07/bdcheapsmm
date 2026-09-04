-- ============================================================
-- BD Cheap SMM - Provider health monitoring
--
-- Additive + idempotent (safe to run on any deployed database).
--
--  1. provider_health: one row per provider holding the latest real API probe
--     result (availability, latency, last success/failure, cumulative
--     counters). Written only by the server (admin actions / cron) using real
--     provider API calls; never client-supplied.
--  2. Additive enum value: log_action gains 'provider_health'.
--  3. RLS: administrators only.
-- ============================================================

-- ---------- 1. provider_health ----------
create table if not exists public.provider_health (
  provider_id uuid primary key references public.providers (id) on delete cascade,
  status text not null default 'unknown'
    check (status in ('healthy', 'slow', 'down', 'unknown')),
  latency_ms integer,
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  total_checks integer not null default 0,
  total_failures integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint provider_health_checks_non_negative check (total_checks >= 0),
  constraint provider_health_failures_non_negative check (total_failures >= 0)
);

create index if not exists idx_provider_health_status on public.provider_health (status);

-- ---------- 2. Additive enum value ----------
alter type public.log_action add value if not exists 'provider_health';

-- ---------- 3. RLS (admin only) ----------
alter table public.provider_health enable row level security;

create policy "provider_health_select_admin" on public.provider_health
  for select using (public.is_admin());
create policy "provider_health_insert_admin" on public.provider_health
  for insert with check (public.is_admin());
create policy "provider_health_update_admin" on public.provider_health
  for update using (public.is_admin()) with check (public.is_admin());
create policy "provider_health_delete_admin" on public.provider_health
  for delete using (public.is_admin());
