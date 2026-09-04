-- ============================================================
-- Daily login coin economy
-- 1 Coin = $0.001. Full 30-day cycle max = 150 Coins ($0.15).
-- Coins are stored separately and never credited to wallet balance.
-- ============================================================

alter table public.profiles
  add column if not exists coin_balance integer not null default 0;

alter table public.profiles
  drop constraint if exists profiles_coin_balance_non_negative;
alter table public.profiles
  add constraint profiles_coin_balance_non_negative check (coin_balance >= 0);

alter table public.login_streaks
  add column if not exists cycle_start_date date;
alter table public.login_streaks
  add column if not exists cycle_coins integer not null default 0;

alter table public.login_streaks
  drop constraint if exists login_streaks_cycle_coins_non_negative;
alter table public.login_streaks
  add constraint login_streaks_cycle_coins_non_negative check (cycle_coins >= 0);

alter table public.login_rewards
  add column if not exists coins integer;
alter table public.login_rewards
  add column if not exists usd_value numeric(12, 6);

update public.login_rewards
   set coins = coalesce(coins, greatest(round(amount)::integer, 0))
 where coins is null;

update public.login_rewards
   set usd_value = coalesce(usd_value, (coalesce(coins, 0)::numeric * 0.001))
 where usd_value is null;

alter table public.login_rewards
  alter column coins set default 0;
alter table public.login_rewards
  alter column coins set not null;

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
  v_ladder integer[] := array[3, 4, 5, 5, 6, 7, 10];
  v_base_coins integer;
  v_coins integer;
  v_usd numeric(12, 6);
  v_cycle_start date;
  v_cycle_coins integer;
  v_remaining integer;
  v_reward_id uuid;
  v_coin_balance integer;
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

  insert into public.login_streaks (
    user_id, current_streak, longest_streak, last_claim_date, total_claims, cycle_start_date, cycle_coins
  )
  values (v_user_id, 0, 0, null, 0, null, 0)
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

  if v_streak.cycle_start_date is null or v_today >= (v_streak.cycle_start_date + 30) then
    v_cycle_start := v_today;
    v_cycle_coins := 0;
  else
    v_cycle_start := v_streak.cycle_start_date;
    v_cycle_coins := v_streak.cycle_coins;
  end if;

  v_base_coins := v_ladder[((v_new_streak - 1) % 7) + 1];
  v_remaining := greatest(150 - v_cycle_coins, 0);
  v_coins := least(v_base_coins, v_remaining);
  v_usd := (v_coins::numeric * 0.001);

  update public.profiles
     set coin_balance = coin_balance + v_coins
   where id = v_user_id
  returning coin_balance into v_coin_balance;

  insert into public.login_rewards (
    user_id, claim_date, streak_day, amount, currency, transaction_id, coins, usd_value
  )
  values (
    v_user_id, v_today, v_new_streak, v_coins, 'COIN', null, v_coins, v_usd
  )
  returning id into v_reward_id;

  update public.login_streaks
     set current_streak = v_new_streak,
         longest_streak = greatest(longest_streak, v_new_streak),
         last_claim_date = v_today,
         total_claims = total_claims + 1,
         cycle_start_date = v_cycle_start,
         cycle_coins = v_cycle_coins + v_coins
   where user_id = v_user_id;

  return jsonb_build_object(
    'reward_id', v_reward_id,
    'coins', v_coins,
    'usd_value', v_usd,
    'streak', v_new_streak,
    'claim_date', v_today,
    'coin_balance', v_coin_balance,
    'cycle_coins', v_cycle_coins + v_coins,
    'cycle_remaining', greatest(150 - (v_cycle_coins + v_coins), 0)
  );
exception
  when unique_violation then
    raise exception 'Already claimed today';
end;
$$;

grant execute on function public.claim_daily_login_reward() to authenticated;
