-- ============================================================
-- BD Cheap SMM - Initial schema
-- Run inside Supabase SQL editor or via supabase db push.
-- ============================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ---------- Enums ----------
create type public.app_role as enum ('admin', 'user');
create type public.user_status as enum ('active', 'banned');
create type public.order_status as enum (
  'pending',
  'processing',
  'in_progress',
  'completed',
  'partial',
  'cancelled',
  'refunded',
  'failed',
  'rejected'
);
create type public.payment_status as enum ('pending', 'approved', 'rejected');
create type public.ticket_status as enum ('open', 'waiting', 'closed');
create type public.transaction_type as enum (
  'deposit',
  'order_deduction',
  'refund',
  'adjustment'
);
create type public.provider_status as enum ('active', 'inactive');
create type public.notification_type as enum (
  'payment_approved',
  'payment_rejected',
  'order_completed',
  'order_cancelled',
  'system_announcement',
  'ticket_reply',
  'order_status'
);
create type public.log_action as enum (
  'create',
  'update',
  'delete',
  'approve',
  'reject',
  'login',
  'logout',
  'order_create',
  'order_cancel',
  'order_refill',
  'order_retry',
  'provider_sync',
  'service_import',
  'balance_adjust',
  'settings_update',
  'coupon_apply'
);

-- ---------- Profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  balance numeric(12, 2) not null default 0 check (balance >= 0),
  role public.app_role not null default 'user',
  status public.user_status not null default 'active',
  country text,
  currency text not null default 'BDT',
  timezone text not null default 'Asia/Dhaka',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Categories ----------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  icon text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Providers ----------
create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  api_url text not null,
  api_key text not null,
  api_key_encrypted boolean not null default false,
  status public.provider_status not null default 'active',
  priority int not null default 0,
  balance numeric(12, 2),
  last_sync_at timestamptz,
  sync_status text,
  sync_message text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Services ----------
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories (id) on delete set null,
  provider_id uuid references public.providers (id) on delete set null,
  provider_service_id text,
  name text not null,
  slug text not null unique,
  description text,
  price numeric(12, 2) not null default 0,
  provider_price numeric(12, 2),
  min_quantity int not null default 1,
  max_quantity int not null default 100,
  average_time text,
  type text,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  is_favorite boolean not null default false,
  profit_margin numeric(6, 2) not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, provider_service_id)
);

create index if not exists idx_services_category on public.services (category_id);
create index if not exists idx_services_provider on public.services (provider_id);
create index if not exists idx_services_slug on public.services (slug);
create index if not exists idx_services_active on public.services (is_active);

-- ---------- Orders ----------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references public.profiles (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  provider_id uuid references public.providers (id) on delete set null,
  provider_order_id text,
  link text not null,
  quantity int not null,
  price numeric(12, 2) not null default 0,
  status public.order_status not null default 'pending',
  start_count int,
  remain int,
  cancel_count int,
  refill_count int,
  charge numeric(12, 2) default 0,
  currency text not null default 'BDT',
  provider_response jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_user on public.orders (user_id);
create index if not exists idx_orders_service on public.orders (service_id);
create index if not exists idx_orders_provider on public.orders (provider_id);
create index if not exists idx_orders_status on public.orders (status);
create index if not exists idx_orders_created on public.orders (created_at desc);
create index if not exists idx_orders_number on public.orders (order_number);

-- ---------- Payment requests ----------
create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  method text not null,
  sender_number text not null,
  amount numeric(12, 2) not null,
  currency text not null default 'BDT',
  transaction_id text not null,
  screenshot_url text,
  note text,
  status public.payment_status not null default 'pending',
  admin_note text,
  processed_by uuid references public.profiles (id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payment_user on public.payment_requests (user_id);
create index if not exists idx_payment_status on public.payment_requests (status);

-- ---------- Transactions ----------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.transaction_type not null,
  amount numeric(12, 2) not null,
  balance_after numeric(12, 2),
  description text,
  reference_id uuid,
  reference_type text,
  currency text not null default 'BDT',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_transactions_user on public.transactions (user_id);
create index if not exists idx_transactions_type on public.transactions (type);
create index if not exists idx_transactions_created on public.transactions (created_at desc);

-- ---------- Tickets ----------
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null,
  status public.ticket_status not null default 'open',
  priority text not null default 'normal',
  category text,
  assigned_to uuid references public.profiles (id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tickets_user on public.tickets (user_id);
create index if not exists idx_tickets_status on public.tickets (status);

-- ---------- Ticket messages ----------
create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  message text not null,
  is_staff boolean not null default false,
  attachment_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ticket_messages_ticket on public.ticket_messages (ticket_id);

-- ---------- Notifications ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null default 'system_announcement',
  title text not null,
  body text,
  is_read boolean not null default false,
  link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications (user_id, is_read);

-- ---------- Settings ----------
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Coupons ----------
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null default 'percent',
  discount_value numeric(12, 2) not null default 0,
  min_amount numeric(12, 2) default 0,
  max_discount numeric(12, 2),
  usage_limit int default null,
  used_count int not null default 0,
  per_user_limit int default 1,
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Logs (audit) ----------
create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  action public.log_action not null,
  entity_type text,
  entity_id text,
  description text,
  ip text,
  user_agent text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_logs_user on public.logs (user_id);
create index if not exists idx_logs_created on public.logs (created_at desc);

-- ---------- API keys ----------
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  permissions jsonb not null default '[]'::jsonb,
  last_used_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Favorite services (join table) ----------
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, service_id)
);

create index if not exists idx_favorites_user on public.favorites (user_id);

-- ---------- updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','categories','providers','services','orders','payment_requests',
    'transactions','tickets','ticket_messages','notifications','settings','coupons',
    'logs','api_keys','favorites'
  ]
  loop
    execute format(
      'drop trigger if exists set_updated_at on public.%I; create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at();',
      t, t
    );
  end loop;
end;
$$;
