-- ============================================================
-- Atomic order create + wallet charge
-- Inserts an order only if the locked profile can cover the cost.
-- Prevents unpaid / $0-balance orders and negative balances.
-- Additive + idempotent. Does not replace deduct_order_cost.
-- ============================================================

create or replace function public.create_and_charge_order(
  p_user_id uuid,
  p_order_number text,
  p_service_id uuid,
  p_provider_id uuid,
  p_link text,
  p_quantity integer,
  p_price numeric,
  p_currency text
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_order public.orders;
  v_price numeric(12, 2);
begin
  if auth.uid() is not null and auth.uid() <> p_user_id and not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  if p_quantity is null or p_quantity < 1 then
    raise exception 'Invalid quantity';
  end if;

  v_price := round(coalesce(p_price, 0)::numeric, 2);
  if v_price < 0 then
    raise exception 'Invalid order amount';
  end if;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'User not found';
  end if;
  if v_profile.status <> 'active' then
    raise exception 'Account suspended';
  end if;

  if v_profile.balance <= 0 then
    raise exception 'INSUFFICIENT_BALANCE:%:%', v_profile.balance, v_price
      using errcode = 'P0001';
  end if;

  if v_price > 0 then
    if v_profile.balance < v_price then
      raise exception 'INSUFFICIENT_BALANCE:%:%', v_profile.balance, v_price
        using errcode = 'P0001';
    end if;

    update public.profiles
      set balance = balance - v_price
      where id = p_user_id
        and balance >= v_price;
    if not found then
      raise exception 'INSUFFICIENT_BALANCE:%:%', v_profile.balance, v_price
        using errcode = 'P0001';
    end if;
  end if;

  insert into public.orders (
    order_number,
    user_id,
    service_id,
    provider_id,
    link,
    quantity,
    price,
    status,
    currency
  ) values (
    p_order_number,
    p_user_id,
    p_service_id,
    p_provider_id,
    p_link,
    p_quantity,
    v_price,
    'pending',
    coalesce(nullif(p_currency, ''), v_profile.currency)
  )
  returning * into v_order;

  if v_price > 0 then
    insert into public.transactions (
      user_id,
      type,
      amount,
      balance_after,
      description,
      reference_id,
      reference_type,
      currency
    )
    select
      v_order.user_id,
      'order_deduction',
      -v_price,
      balance,
      'Order #' || v_order.order_number,
      v_order.id,
      'orders',
      v_order.currency
    from public.profiles
    where id = v_order.user_id;
  end if;

  return v_order;
end;
$$;

revoke all on function public.create_and_charge_order(uuid, text, uuid, uuid, text, integer, numeric, text) from public;
grant execute on function public.create_and_charge_order(uuid, text, uuid, uuid, text, integer, numeric, text) to authenticated;
grant execute on function public.create_and_charge_order(uuid, text, uuid, uuid, text, integer, numeric, text) to service_role;

-- Users must not insert unpaid order rows directly. Creation goes through
-- create_and_charge_order (security definer), which charges first.
drop policy if exists "orders_insert_own" on public.orders;
drop policy if exists "orders_insert_admin" on public.orders;
create policy "orders_insert_admin" on public.orders
  for insert with check (public.is_admin());
