-- ============================================================
-- Follow-up to 0015_login_coins.sql
-- Exact 30-day schedule totaling 150 Coins ($0.15).
-- 7-day ladder: 3, 3, 4, 5, 6, 7, 8  (week = 36; 4 weeks + 2 days = 150)
-- Does not create tables. Replaces claim_daily_login_reward only.
-- Wallet balance is never credited.
-- ============================================================

update public.login_streaks
   set cycle_coins = least(cycle_coins, 150)
 where cycle_coins > 150;

alter table public.login_streaks
  drop constraint if exists login_streaks_cycle_coins_max;
alter table public.login_streaks
  add constraint login_streaks_cycle_coins_max check (cycle_coins <= 150);

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
  v_ladder integer[] := array[3, 3, 4, 5, 6, 7, 8];
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

  v_remaining := greatest(150 - v_cycle_coins, 0);
  if v_remaining <= 0 then
    raise exception 'Cycle coin limit reached';
  end if;

  v_base_coins := v_ladder[((v_new_streak - 1) % 7) + 1];
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
