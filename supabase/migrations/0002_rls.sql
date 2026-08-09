-- ============================================================
-- BD Cheap SMM - Row Level Security (RLS) policies
-- ============================================================

-- ---------- Helper functions ----------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.status = 'active'
  );
$$;

create or replace function public.current_profile()
returns public.profiles
language sql
security definer
set search_path = public
stable
as $$
  select * from public.profiles p where p.id = auth.uid() limit 1;
$$;

create or replace function public.is_banned()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'banned'
  );
$$;

-- ---------- Enable RLS ----------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.providers enable row level security;
alter table public.services enable row level security;
alter table public.orders enable row level security;
alter table public.payment_requests enable row level security;
alter table public.transactions enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.settings enable row level security;
alter table public.coupons enable row level security;
alter table public.logs enable row level security;
alter table public.api_keys enable row level security;
alter table public.favorites enable row level security;

-- ---------- Profiles ----------
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_select_admin" on public.profiles
  for select using (public.is_admin());
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from public.profiles where id = auth.uid())
    and status = (select status from public.profiles where id = auth.uid())
  );
create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin())
  with check (true);
create policy "profiles_insert_trigger" on public.profiles
  for insert with check (auth.uid() = id);

-- ---------- Categories ----------
create policy "categories_select_all" on public.categories
  for select using (true);
create policy "categories_admin_all" on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Providers ----------
create policy "providers_admin_all" on public.providers
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Services ----------
create policy "services_select_all" on public.services
  for select using (true);
create policy "services_admin_all" on public.services
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Orders ----------
create policy "orders_select_own" on public.orders
  for select using (auth.uid() = user_id);
create policy "orders_select_admin" on public.orders
  for select using (public.is_admin());
create policy "orders_insert_own" on public.orders
  for insert with check (auth.uid() = user_id);
create policy "orders_update_admin" on public.orders
  for update using (public.is_admin()) with check (true);
create policy "orders_update_own" on public.orders
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Payment requests ----------
create policy "payment_select_own" on public.payment_requests
  for select using (auth.uid() = user_id);
create policy "payment_select_admin" on public.payment_requests
  for select using (public.is_admin());
create policy "payment_insert_own" on public.payment_requests
  for insert with check (auth.uid() = user_id);
create policy "payment_update_admin" on public.payment_requests
  for update using (public.is_admin()) with check (true);

-- ---------- Transactions ----------
create policy "transactions_select_own" on public.transactions
  for select using (auth.uid() = user_id);
create policy "transactions_select_admin" on public.transactions
  for select using (public.is_admin());
create policy "transactions_admin_insert" on public.transactions
  for insert with check (public.is_admin());

-- ---------- Tickets ----------
create policy "tickets_select_own" on public.tickets
  for select using (auth.uid() = user_id);
create policy "tickets_select_admin" on public.tickets
  for select using (public.is_admin());
create policy "tickets_insert_own" on public.tickets
  for insert with check (auth.uid() = user_id);
create policy "tickets_update_own" on public.tickets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tickets_update_admin" on public.tickets
  for update using (public.is_admin()) with check (true);

-- ---------- Ticket messages ----------
create policy "tm_select_own" on public.ticket_messages
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.tickets t where t.id = ticket_id and t.user_id = auth.uid())
    or public.is_admin()
  );
create policy "tm_insert_own" on public.ticket_messages
  for insert with check (auth.uid() = user_id);
create policy "tm_insert_admin" on public.ticket_messages
  for insert with check (public.is_admin());
create policy "tm_update_admin" on public.ticket_messages
  for update using (public.is_admin()) with check (true);

-- ---------- Notifications ----------
create policy "notifications_select_own" on public.notifications
  for select using (auth.uid() = user_id);
create policy "notifications_select_admin" on public.notifications
  for select using (public.is_admin());
create policy "notifications_update_own" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notifications_insert_admin" on public.notifications
  for insert with check (public.is_admin());

-- ---------- Settings ----------
create policy "settings_select_public" on public.settings
  for select using (is_public = true);
create policy "settings_select_admin" on public.settings
  for select using (public.is_admin());
create policy "settings_admin_all" on public.settings
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Coupons ----------
create policy "coupons_select_all" on public.coupons
  for select using (true);
create policy "coupons_admin_all" on public.coupons
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Logs ----------
create policy "logs_admin_all" on public.logs
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- API keys ----------
create policy "api_keys_select_own" on public.api_keys
  for select using (auth.uid() = user_id);
create policy "api_keys_select_admin" on public.api_keys
  for select using (public.is_admin());
create policy "api_keys_insert_own" on public.api_keys
  for insert with check (auth.uid() = user_id);
create policy "api_keys_update_own" on public.api_keys
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "api_keys_delete_own" on public.api_keys
  for delete using (auth.uid() = user_id);
create policy "api_keys_delete_admin" on public.api_keys
  for delete using (public.is_admin());

-- ---------- Favorites ----------
create policy "favorites_select_own" on public.favorites
  for select using (auth.uid() = user_id);
create policy "favorites_insert_own" on public.favorites
  for insert with check (auth.uid() = user_id);
create policy "favorites_delete_own" on public.favorites
  for delete using (auth.uid() = user_id);
create policy "favorites_admin_all" on public.favorites
  for all using (public.is_admin()) with check (public.is_admin());
