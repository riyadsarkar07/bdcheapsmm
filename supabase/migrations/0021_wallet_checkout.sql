-- Service prices and coupon thresholds are USD. Wallet transactions retain
-- their actual denomination. Never relabel existing orders or balances.
create function public.wallet_convert(amount numeric, source text, target text)
returns numeric language plpgsql immutable strict as $$
begin
  if source = target then return round(amount, 2); end if;
  if source = 'USD' and target = 'BDT' then return round(amount * 126, 2); end if;
  if source = 'BDT' and target = 'USD' then return round(amount / 126, 2); end if;
  raise exception 'Exchange rate unavailable for % to %', source, target;
end;
$$;

-- Currency changes used to relabel money without conversion. Keep each
-- wallet in its recorded denomination so historical entries stay comparable.
create function public.keep_wallet_currency() returns trigger language plpgsql as $$
begin
  if old.currency is distinct from new.currency then
    raise exception 'Wallet currency is fixed for this account';
  end if;
  return new;
end;
$$;
create trigger keep_wallet_currency before update of currency on public.profiles
for each row execute function public.keep_wallet_currency();

create function public.order_quote_usd(p_user_id uuid, p_service_id uuid, p_quantity integer, p_coupon text)
returns numeric language plpgsql stable set search_path = public as $$
declare
  s services;
  c coupons;
  total numeric;
  discount numeric;
begin
  select * into strict s from services where id = p_service_id and is_active;
  if p_quantity is null or p_quantity not between s.min_quantity and s.max_quantity then
    raise exception 'Invalid service quantity';
  end if;
  total := round(s.price * p_quantity / 1000, 2);
  if total <= 0 then raise exception 'Invalid order price'; end if;
  if nullif(trim(p_coupon), '') is null then return total; end if;
  select * into c from public.get_coupon(trim(p_coupon));
  if c.id is null then raise exception 'Invalid or expired coupon'; end if;
  if total < c.min_amount then raise exception 'Minimum order amount for coupon not reached'; end if;
  if (select count(*) from transactions where user_id = p_user_id
      and reference_type = 'coupon' and reference_id = c.id) >= coalesce(c.per_user_limit, 1) then
    raise exception 'Coupon usage limit reached';
  end if;
  discount := case when c.discount_type = 'percent'
    then least(round(total * c.discount_value / 100, 2), c.max_discount)
    else c.discount_value end;
  return greatest(total - discount, 0);
end;
$$;
revoke all on function public.order_quote_usd(uuid,uuid,integer,text) from public, anon, authenticated;
grant execute on function public.order_quote_usd(uuid,uuid,integer,text) to service_role;

drop function public.create_and_charge_order(uuid,text,uuid,uuid,text,integer,numeric,text);
create function public.create_and_charge_order(p_user_id uuid, p_order_number text, p_service_id uuid,
  p_provider_id uuid, p_link text, p_quantity integer, p_price numeric, p_coupon text, p_cost numeric)
returns public.orders language plpgsql security definer set search_path = public as $$
declare
  wallet profiles;
  s services;
  c coupons;
  sale numeric;
  debit numeric;
  ord orders;
begin
  select * into strict wallet from profiles where id = p_user_id and status = 'active' for update;
  select * into strict s from services where id = p_service_id and provider_id = p_provider_id and is_active for share;
  if nullif(trim(p_coupon), '') is not null then
    select * into strict c from coupons where upper(code) = upper(trim(p_coupon)) for update;
  end if;
  sale := public.order_quote_usd(p_user_id, p_service_id, p_quantity, p_coupon);
  if sale is distinct from p_price or p_cost is null or p_cost <= 0 or sale < p_cost then
    raise exception 'Order price changed or below provider cost. Review the current quote.';
  end if;
  debit := public.wallet_convert(sale, 'USD', wallet.currency);
  if wallet.balance < debit then raise exception 'INSUFFICIENT_BALANCE:%:%', wallet.balance, debit; end if;
  update profiles set balance = balance - debit where id = wallet.id returning * into wallet;
  insert into orders(order_number,user_id,service_id,provider_id,link,quantity,price,charge,status,currency)
    values(p_order_number,wallet.id,s.id,s.provider_id,p_link,p_quantity,sale,p_cost,'pending','USD') returning * into ord;
  insert into transactions(user_id,type,amount,balance_after,description,reference_id,reference_type,currency)
    values(wallet.id,'order_deduction',-debit,wallet.balance,'Order #' || ord.order_number,ord.id,'orders',wallet.currency);
  if c.id is not null then
    update coupons set used_count = used_count + 1 where id = c.id;
    insert into transactions(user_id,type,amount,balance_after,description,reference_id,reference_type,currency)
      values(wallet.id,'adjustment',0,wallet.balance,'Coupon ' || c.code,c.id,'coupon',wallet.currency);
  end if;
  return ord;
end;
$$;
revoke all on function public.create_and_charge_order(uuid,text,uuid,uuid,text,integer,numeric,text,numeric) from public, anon, authenticated;
grant execute on function public.create_and_charge_order(uuid,text,uuid,uuid,text,integer,numeric,text,numeric) to service_role;
revoke all on function public.use_coupon(uuid,uuid,numeric,text,text), public.deduct_order_cost(uuid,uuid) from public, anon, authenticated;

-- All refund callers lock the order and reverse the original wallet entry.
create or replace function public.refund_order(p_order_id uuid, p_refunded_by uuid)
returns public.orders language plpgsql security definer set search_path = public as $$
declare
  ord orders;
  wallet profiles;
  credit numeric;
begin
  select * into strict ord from orders where id = p_order_id for update;
  if not exists (select 1 from transactions where reference_type='orders' and reference_id=ord.id and type='refund') then
    select * into strict wallet from profiles where id=ord.user_id for update;
    select sum(public.wallet_convert(-amount,currency,wallet.currency)) into credit from transactions
      where user_id=ord.user_id and reference_type='orders' and reference_id=ord.id and type='order_deduction';
    if credit is null or credit <= 0 then raise exception 'No recorded debit. Review the wallet ledger.'; end if;
    update profiles set balance=balance+credit where id=wallet.id returning * into wallet;
    insert into transactions(user_id,type,amount,balance_after,description,reference_id,reference_type,currency)
      values(wallet.id,'refund',credit,wallet.balance,'Refund for order #' || ord.order_number,ord.id,'orders',wallet.currency);
    insert into logs(user_id,action,entity_type,entity_id,description)
      values(p_refunded_by,'order_cancel','orders',ord.id::text,'Wallet refund for ' || ord.order_number);
  end if;
  update orders set status='refunded' where id=ord.id returning * into ord;
  return ord;
end;
$$;
revoke all on function public.refund_order(uuid,uuid) from public, anon, authenticated;
grant execute on function public.refund_order(uuid,uuid) to service_role;

update storage.buckets set public=false, file_size_limit=5242880,
  allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif'] where id='payment-proofs';
drop policy if exists payment_proofs_upload on storage.objects;
create policy payment_proofs_upload on storage.objects for insert to authenticated
with check(bucket_id='payment-proofs' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists payment_proofs_read_own on storage.objects;
create policy payment_proofs_read_own on storage.objects for select to authenticated
using(bucket_id='payment-proofs' and (owner=auth.uid() or public.is_admin()));

create or replace function public.approve_payment(p_id uuid, admin_id uuid, p_note text default null)
returns public.payment_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payment_requests;
  wallet_currency text;
  credited numeric;
  ref_currency text;
  v_rate numeric(6, 2);
  v_enabled boolean;
  v_ref record;
  v_commission numeric(12, 2);
  v_comm public.referral_commissions;
  v_tx_id uuid;
begin
  if admin_id is distinct from auth.uid() or not public.is_admin() then
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

  select currency into strict wallet_currency from public.profiles where id = v_payment.user_id for update;
  credited := public.wallet_convert(v_payment.amount, v_payment.currency, wallet_currency);
  if credited <= 0 then raise exception 'Deposit rounds to zero in wallet currency'; end if;
  update public.profiles set balance = balance + credited where id = v_payment.user_id;

  insert into public.transactions (user_id, type, amount, balance_after, description, reference_id, reference_type, currency)
  select v_payment.user_id, 'deposit', credited, balance, 'Payment request approved (' || v_payment.method || ' - ' || v_payment.transaction_id || ')', v_payment.id, 'payment_requests', wallet_currency
  from public.profiles where id = v_payment.user_id;

  insert into public.notifications (user_id, type, title, body, link)
  values (v_payment.user_id, 'payment_approved', 'Payment Approved', 'Your ' || v_payment.method || ' deposit of ' || v_payment.amount || ' ' || v_payment.currency || ' has been approved.', '/add-funds');

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
      select currency into strict ref_currency from public.profiles where id=v_ref.referrer_id for update;
      v_commission := public.wallet_convert(v_payment.amount * v_rate / 100.0, v_payment.currency, ref_currency);

      if v_commission > 0 then
        -- Exactly-once per approved deposit (unique payment_request_id).
        insert into public.referral_commissions
          (referrer_id, referred_user_id, payment_request_id, deposit_amount, rate_percent, amount, currency, status)
        values
          (v_ref.referrer_id, v_payment.user_id, v_payment.id, public.wallet_convert(v_payment.amount, v_payment.currency, ref_currency), v_rate, v_commission, ref_currency, 'approved')
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

drop policy if exists orders_update_own on public.orders;

-- Direct inserts must meet the same ownership rules as the submission form.
drop policy if exists payment_insert_own on public.payment_requests;
create policy payment_insert_own on public.payment_requests for insert to authenticated
with check (user_id=auth.uid() and status='pending' and currency='BDT' and amount>0
  and processed_by is null and processed_at is null
  and screenshot_url ~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.(png|jpeg|webp|gif)$')
  and exists (select 1 from storage.objects o where o.bucket_id='payment-proofs'
    and o.name=screenshot_url and o.owner=auth.uid()));
