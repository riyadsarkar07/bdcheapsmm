-- ============================================================
-- BD Cheap SMM - Referral system
--
-- Safe to run on any deployed database (all statements are idempotent
-- except the enum additions, which are additive-only).
--
--  1. profiles.referral_code (unique) + backfill for existing users.
--  2. referrals table (one row per referred user; unique + not-self).
--  3. referral_commissions table (one row per approved deposit that earned a
--     commission; unique payment_request_id prevents double rewards).
--  4. Additive enum values: transaction_type / notification_type / log_action
--     gain 'referral_commission'.
--  5. 'referrals' settings key (configurable commission rate).
--  6. handle_new_user: generate a referral code and attach the referrer from
--     raw_user_meta_data ->> 'ref' (server-side, self-referral safe).
--  7. approve_payment: grant the referrer a commission only when a referred
--     user's deposit is approved. Value computed in the DB from the stored
--     rate; never trusted from the client.
--  8. RLS for the new tables + freeze referral_code on self profile edits.
-- ============================================================

-- ---------- 1. profiles.referral_code ----------
alter table public.profiles
  add column if not exists referral_code text;

create unique index if not exists profiles_referral_code_unique
  on public.profiles (referral_code);

-- ---------- 2. Referral code generator ----------
create or replace function public.generate_referral_code()
returns text
language sql
volatile
set search_path = public
as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
$$;

-- Backfill existing profiles that have no code yet.
do $$
declare
  v_rec record;
  v_code text;
  v_attempts int;
begin
  for v_rec in select id from public.profiles where referral_code is null
  loop
    v_attempts := 0;
    loop
      v_code := public.generate_referral_code();
      exit when v_attempts >= 20
        or not exists (select 1 from public.profiles where referral_code = v_code and id <> v_rec.id);
      v_attempts := v_attempts + 1;
    end loop;
    update public.profiles set referral_code = v_code where id = v_rec.id;
  end loop;
end;
$$;

-- ---------- 3. Referrals ----------
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referred_user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referrals_referred_unique unique (referred_user_id),
  constraint referrals_not_self check (referrer_id <> referred_user_id)
);

create index if not exists idx_referrals_referrer on public.referrals (referrer_id);
create index if not exists idx_referrals_referred on public.referrals (referred_user_id);

-- ---------- 4. Referral commissions ----------
create table if not exists public.referral_commissions (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referred_user_id uuid not null references public.profiles (id) on delete cascade,
  payment_request_id uuid not null references public.payment_requests (id) on delete cascade,
  transaction_id uuid references public.transactions (id) on delete set null,
  deposit_amount numeric(12, 2) not null,
  rate_percent numeric(6, 2) not null,
  amount numeric(12, 2) not null,
  currency text not null default 'BDT',
  status public.payment_status not null default 'approved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referral_commissions_payment_unique unique (payment_request_id),
  constraint referral_commissions_not_self check (referrer_id <> referred_user_id)
);

create index if not exists idx_referral_commissions_referrer on public.referral_commissions (referrer_id);
create index if not exists idx_referral_commissions_referred on public.referral_commissions (referred_user_id);

-- ---------- 5. Additive enum values ----------
alter type public.transaction_type add value if not exists 'referral_commission';
alter type public.notification_type add value if not exists 'referral_commission';
alter type public.log_action add value if not exists 'referral_commission';

-- ---------- 6. Referral settings (configurable commission rate) ----------
insert into public.settings (key, value, is_public) values
  ('referrals', '{"rate_percent":5,"enabled":true}'::jsonb, true)
on conflict (key) do nothing;

-- ---------- 7. handle_new_user: referral code + attach referrer ----------
drop trigger if exists on_auth_user_created on auth.users;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_attempts int := 0;
  v_ref_code text := upper(coalesce(new.raw_user_meta_data ->> 'ref', ''));
begin
  loop
    v_code := public.generate_referral_code();
    exit when v_attempts >= 20
      or not exists (select 1 from public.profiles where referral_code = v_code);
    v_attempts := v_attempts + 1;
  end loop;

  insert into public.profiles (id, email, full_name, avatar_url, referral_code)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    v_code
  )
  on conflict (id) do nothing;

  -- Attach the referrer, but never allow a user to refer themselves.
  if v_ref_code <> '' and v_ref_code <> v_code then
    begin
      insert into public.referrals (referrer_id, referred_user_id)
      select p.id, new.id
      from public.profiles p
      where p.referral_code = v_ref_code
        and p.id <> new.id
      on conflict (referred_user_id) do nothing;
    exception when others then
      null;
    end;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 8. approve_payment: grant referral commission on approval ----------
create or replace function public.approve_payment(p_id uuid, admin_id uuid, p_note text default null)
returns public.payment_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payment_requests;
  v_rate numeric(6, 2);
  v_enabled boolean;
  v_ref record;
  v_commission numeric(12, 2);
  v_comm public.referral_commissions;
  v_tx_id uuid;
begin
  if not exists (select 1 from public.profiles where id = admin_id and role = 'admin') then
    raise exception 'Forbidden';
  end if;

  select * into v_payment from public.payment_requests where id = p_id for update;
  if not found then
    raise exception 'Payment request not found';
  end if;
  if v_payment.status <> 'pending' then
    raise exception 'Payment request already processed';
  end if;

  update public.payment_requests
    set status = 'approved', processed_by = admin_id, processed_at = now(), admin_note = coalesce(p_note, admin_note)
    where id = p_id;

  update public.profiles set balance = balance + v_payment.amount where id = v_payment.user_id;

  insert into public.transactions (user_id, type, amount, balance_after, description, reference_id, reference_type, currency)
  select v_payment.user_id, 'deposit', v_payment.amount, balance, 'Payment request approved (' || v_payment.method || ' - ' || v_payment.transaction_id || ')', v_payment.id, 'payment_requests', v_payment.currency
  from public.profiles where id = v_payment.user_id;

  insert into public.notifications (user_id, type, title, body, link)
  values (v_payment.user_id, 'payment_approved', 'Payment Approved', 'Your ' || v_payment.method || ' deposit of ' || v_payment.amount || ' ' || v_payment.currency || ' has been approved.', '/dashboard/add-funds');

  insert into public.logs (user_id, action, entity_type, entity_id, description)
  values (admin_id, 'approve', 'payment_requests', p_id::text, 'Approved payment request ' || p_id::text);

  -- ---------- Referral commission (approved deposits only) ----------
  select
    coalesce((select (value ->> 'rate_percent')::numeric(6, 2) from public.settings where key = 'referrals'), 0),
    coalesce((select (value ->> 'enabled')::boolean from public.settings where key = 'referrals'), true)
  into v_rate, v_enabled;

  if v_enabled and v_rate > 0 then
    select r.referrer_id into v_ref
    from public.referrals r
    where r.referred_user_id = v_payment.user_id
    limit 1;

    if found and v_ref.referrer_id <> v_payment.user_id then
      v_commission := round(v_payment.amount * v_rate / 100.0, 2);

      if v_commission > 0 then
        -- Exactly-once per approved deposit (unique payment_request_id).
        insert into public.referral_commissions
          (referrer_id, referred_user_id, payment_request_id, deposit_amount, rate_percent, amount, currency, status)
        values
          (v_ref.referrer_id, v_payment.user_id, v_payment.id, v_payment.amount, v_rate, v_commission, v_payment.currency, 'approved')
        on conflict (payment_request_id) do nothing
        returning * into v_comm;

        if v_comm.id is not null then
          update public.profiles set balance = balance + v_comm.amount where id = v_comm.referrer_id;

          insert into public.transactions
            (user_id, type, amount, balance_after, description, reference_id, reference_type, currency, meta)
          select
            v_comm.referrer_id,
            'referral_commission',
            v_comm.amount,
            balance,
            'Referral commission from ' || coalesce((select email from public.profiles where id = v_payment.user_id), v_payment.user_id::text) || ' deposit',
            v_comm.id,
            'referral_commissions',
            v_comm.currency,
            jsonb_build_object('referred_user_id', v_payment.user_id, 'payment_request_id', v_payment.id, 'rate_percent', v_comm.rate_percent)
          from public.profiles where id = v_comm.referrer_id
          returning id into v_tx_id;

          update public.referral_commissions set transaction_id = v_tx_id where id = v_comm.id;

          insert into public.notifications (user_id, type, title, body, link)
          values (v_comm.referrer_id, 'referral_commission', 'Referral Commission Earned', 'You earned ' || v_comm.amount || ' ' || v_comm.currency || ' commission from a referred user deposit.', '/referrals');

          insert into public.logs (user_id, action, entity_type, entity_id, description, meta)
          values (admin_id, 'referral_commission', 'referral_commissions', v_comm.id::text, 'Granted referral commission ' || v_comm.amount || ' ' || v_comm.currency, jsonb_build_object('referred_user_id', v_payment.user_id, 'payment_request_id', v_payment.id, 'rate_percent', v_comm.rate_percent));
        end if;
      end if;
    end if;
  end if;

  return v_payment;
end;
$$;

-- ---------- 9. RLS for referrals & referral_commissions ----------
alter table public.referrals enable row level security;
alter table public.referral_commissions enable row level security;

create policy "referrals_select_own" on public.referrals
  for select using (auth.uid() = referrer_id);
create policy "referrals_select_admin" on public.referrals
  for select using (public.is_admin());

create policy "referral_commissions_select_own" on public.referral_commissions
  for select using (auth.uid() = referrer_id);
create policy "referral_commissions_select_admin" on public.referral_commissions
  for select using (public.is_admin());

-- Users must not be able to tamper with their own referral code.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from public.profiles where id = auth.uid())
    and status = (select status from public.profiles where id = auth.uid())
    and balance = (select balance from public.profiles where id = auth.uid())
    and referral_code = (select referral_code from public.profiles where id = auth.uid())
  );

-- ---------- Grants ----------
grant execute on function public.generate_referral_code() to authenticated;
grant execute on function public.approve_payment(uuid, uuid, text) to authenticated;
