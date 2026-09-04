-- ============================================================
-- BD Cheap SMM - Notice board, order goals, daily login rewards
-- Additive + idempotent.
-- ============================================================

alter type public.transaction_type add value if not exists 'login_reward';

-- ---------- Notices ----------
create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  category text not null default 'announcement'
    check (category in ('announcement', 'update', 'maintenance', 'offer')),
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notices_published on public.notices (is_published, published_at desc);

create table if not exists public.notice_reads (
  notice_id uuid not null references public.notices (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notice_id, user_id)
);

create index if not exists idx_notice_reads_user on public.notice_reads (user_id);

-- ---------- Order goals ----------
create table if not exists public.order_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  metric text not null default 'followers'
    check (metric in ('followers', 'views', 'likes', 'comments', 'custom')),
  target_quantity integer not null check (target_quantity > 0),
  service_id uuid references public.services (id) on delete set null,
  link text,
  status text not null default 'active'
    check (status in ('active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_order_goals_user on public.order_goals (user_id, status);

-- ---------- Daily login rewards ----------
create table if not exists public.login_streaks (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_claim_date date,
  total_claims integer not null default 0 check (total_claims >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.login_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  claim_date date not null,
  streak_day integer not null check (streak_day >= 1),
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'BDT',
  transaction_id uuid references public.transactions (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, claim_date)
);

create index if not exists idx_login_rewards_user on public.login_rewards (user_id, created_at desc);

drop trigger if exists set_updated_at on public.notices;
create trigger set_updated_at before update on public.notices
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.order_goals;
create trigger set_updated_at before update on public.order_goals
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.login_streaks;
create trigger set_updated_at before update on public.login_streaks
for each row execute function public.set_updated_at();

-- ---------- RLS ----------
alter table public.notices enable row level security;
alter table public.notice_reads enable row level security;
alter table public.order_goals enable row level security;
alter table public.login_streaks enable row level security;
alter table public.login_rewards enable row level security;

drop policy if exists "notices_select_published" on public.notices;
create policy "notices_select_published" on public.notices
  for select using (is_published = true or public.is_admin());

drop policy if exists "notices_admin_insert" on public.notices;
create policy "notices_admin_insert" on public.notices
  for insert with check (public.is_admin());

drop policy if exists "notices_admin_update" on public.notices;
create policy "notices_admin_update" on public.notices
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "notices_admin_delete" on public.notices;
create policy "notices_admin_delete" on public.notices
  for delete using (public.is_admin());

drop policy if exists "notice_reads_select_own" on public.notice_reads;
create policy "notice_reads_select_own" on public.notice_reads
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "notice_reads_insert_own" on public.notice_reads;
create policy "notice_reads_insert_own" on public.notice_reads
  for insert with check (auth.uid() = user_id);

drop policy if exists "order_goals_select_own" on public.order_goals;
create policy "order_goals_select_own" on public.order_goals
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "order_goals_insert_own" on public.order_goals;
create policy "order_goals_insert_own" on public.order_goals
  for insert with check (auth.uid() = user_id);

drop policy if exists "order_goals_update_own" on public.order_goals;
create policy "order_goals_update_own" on public.order_goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "order_goals_delete_own" on public.order_goals;
create policy "order_goals_delete_own" on public.order_goals
  for delete using (auth.uid() = user_id or public.is_admin());

drop policy if exists "login_streaks_select_own" on public.login_streaks;
create policy "login_streaks_select_own" on public.login_streaks
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "login_rewards_select_own" on public.login_rewards;
create policy "login_rewards_select_own" on public.login_rewards
  for select using (auth.uid() = user_id or public.is_admin());

-- ---------- Daily claim (atomic, one per user per Dhaka date) ----------
create or replace function public.claim_daily_login_reward()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date;
  v_profile public.profiles;
  v_streak public.login_streaks;
  v_new_streak integer;
  v_amount numeric(12, 2);
  v_tx_id uuid;
  v_reward_id uuid;
  v_balance numeric(12, 2);
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_today := (timezone('Asia/Dhaka', now()))::date;

  select * into v_profile from public.profiles where id = v_user_id for update;
  if not found then
    raise exception 'Profile not found';
  end if;
  if v_profile.status = 'banned' then
    raise exception 'Account is suspended';
  end if;

  insert into public.login_streaks (user_id, current_streak, longest_streak, last_claim_date, total_claims)
  values (v_user_id, 0, 0, null, 0)
  on conflict (user_id) do nothing;

  select * into v_streak from public.login_streaks where user_id = v_user_id for update;

  if v_streak.last_claim_date = v_today then
    raise exception 'Already claimed today';
  end if;

  if v_streak.last_claim_date = v_today - 1 then
    v_new_streak := v_streak.current_streak + 1;
  else
    v_new_streak := 1;
  end if;

  v_amount := least(v_new_streak, 7)::numeric;

  update public.profiles
     set balance = balance + v_amount
   where id = v_user_id
  returning balance into v_balance;

  insert into public.transactions (
    user_id, type, amount, balance_after, description, reference_type, currency, meta
  )
  values (
    v_user_id,
    'login_reward',
    v_amount,
    v_balance,
    'Daily login reward (day ' || v_new_streak || ')',
    'login_rewards',
    v_profile.currency,
    jsonb_build_object('streak', v_new_streak, 'claim_date', v_today)
  )
  returning id into v_tx_id;

  insert into public.login_rewards (
    user_id, claim_date, streak_day, amount, currency, transaction_id
  )
  values (
    v_user_id, v_today, v_new_streak, v_amount, v_profile.currency, v_tx_id
  )
  returning id into v_reward_id;

  update public.login_streaks
     set current_streak = v_new_streak,
         longest_streak = greatest(longest_streak, v_new_streak),
         last_claim_date = v_today,
         total_claims = total_claims + 1
   where user_id = v_user_id;

  return jsonb_build_object(
    'reward_id', v_reward_id,
    'amount', v_amount,
    'currency', v_profile.currency,
    'streak', v_new_streak,
    'claim_date', v_today,
    'balance', v_balance
  );
exception
  when unique_violation then
    raise exception 'Already claimed today';
end;
$$;

grant execute on function public.claim_daily_login_reward() to authenticated;
