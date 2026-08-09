-- ============================================================
-- BD Cheap SMM - Audit fixes
-- Addresses issues found during the end-to-end functional audit:
--   1. profiles: users must not be able to edit their own balance
--   2. deduct_order_cost: require explicit user ownership (prevents IDOR)
--   3. refund_order: atomic, idempotent order refund (prevents double credit)
--   4. create_notification: security-definer notifier used by app code
--   5. ticket_messages: users may only reply to tickets they own
-- ============================================================

-- ---------- 1. profiles_update_own: freeze balance/role/status on self edits ----------
-- The old policy let a user change any column (including balance) as long as
-- role/status were unchanged. Rework it so self-updates cannot touch
-- balance, role, or status.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from public.profiles where id = auth.uid())
    and status = (select status from public.profiles where id = auth.uid())
    and balance = (select balance from public.profiles where id = auth.uid())
  );

-- ---------- 2. deduct_order_cost: enforce ownership ----------
-- Drop the old single-argument overload (migration 0003) that had no owner
-- check; the new two-argument version below enforces it.
drop function if exists public.deduct_order_cost(uuid);
create or replace function public.deduct_order_cost(p_order_id uuid, p_user_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;
  if v_order.user_id <> p_user_id then
    raise exception 'Forbidden';
  end if;
  if v_order.status <> 'pending' then
    raise exception 'Order already charged';
  end if;

  update public.profiles set balance = balance - v_order.price where id = v_order.user_id and balance >= v_order.price;
  if not found then
    raise exception 'Insufficient balance';
  end if;

  insert into public.transactions (user_id, type, amount, balance_after, description, reference_id, reference_type, currency)
  select v_order.user_id, 'order_deduction', -v_order.price, balance, 'Order #' || v_order.order_number, v_order.id, 'orders', v_order.currency
  from public.profiles where id = v_order.user_id;

  return v_order;
end;
$$;

-- ---------- 3. refund_order: atomic, idempotent refund ----------
create or replace function public.refund_order(p_order_id uuid, p_refunded_by uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  -- Non-admins may only refund their own orders.
  if not public.is_admin() and v_order.user_id <> auth.uid() then
    raise exception 'Forbidden';
  end if;

  -- Refundable statuses only; already refunded orders are a no-op guard.
  if v_order.status = 'refunded' then
    raise exception 'Order already refunded';
  end if;
  if v_order.status not in ('cancelled', 'failed', 'rejected') and not public.is_admin() then
    raise exception 'Order is not refundable';
  end if;

  update public.profiles set balance = balance + v_order.price where id = v_order.user_id;
  if not found then
    raise exception 'User not found';
  end if;

  insert into public.transactions (user_id, type, amount, balance_after, description, reference_id, reference_type, currency)
  select v_order.user_id, 'refund', v_order.price, balance, 'Refund for order #' || v_order.order_number, v_order.id, 'orders', v_order.currency
  from public.profiles where id = v_order.user_id;

  update public.orders set status = 'refunded' where id = p_order_id;

  insert into public.logs (user_id, action, entity_type, entity_id, description)
  values (p_refunded_by, 'order_cancel', 'orders', p_order_id::text, 'Refunded order ' || v_order.order_number);

  return v_order;
end;
$$;

-- ---------- 4. create_notification: security definer notifier ----------
create or replace function public.create_notification(
  p_user_id uuid,
  p_type public.notification_type,
  p_title text,
  p_body text default null,
  p_link text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, link)
  values (p_user_id, p_type, p_title, p_body, p_link);
end;
$$;

-- ---------- 5. ticket_messages: users can only reply to own tickets ----------
drop policy if exists "tm_insert_own" on public.ticket_messages;
create policy "tm_insert_own" on public.ticket_messages
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.tickets t where t.id = ticket_id and t.user_id = auth.uid())
  );

-- ---------- 6. use_coupon: atomic coupon usage tracking ----------
-- Increments used_count and records a coupon transaction in one go. Runs as
-- the definer so regular users can use coupons without update RLS on coupons
-- or insert RLS on transactions.
create or replace function public.use_coupon(
  p_user_id uuid,
  p_coupon_id uuid,
  p_balance_after numeric,
  p_currency text,
  p_description text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id <> auth.uid() then
    raise exception 'Forbidden';
  end if;
  update public.coupons set used_count = used_count + 1 where id = p_coupon_id;
  insert into public.transactions (user_id, type, amount, balance_after, description, reference_id, reference_type, currency)
  values (p_user_id, 'adjustment', 0, p_balance_after, p_description, p_coupon_id, 'coupon', p_currency);
end;
$$;

-- ---------- Grants ----------
grant execute on function public.deduct_order_cost(uuid, uuid) to authenticated;
grant execute on function public.refund_order(uuid, uuid) to authenticated;
grant execute on function public.create_notification(uuid, public.notification_type, text, text, text) to authenticated;
grant execute on function public.use_coupon(uuid, uuid, numeric, text, text) to authenticated;
