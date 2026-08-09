-- ============================================================
-- BD Cheap SMM - Seed data, business triggers & helper functions
-- ============================================================

-- ---------- Trigger: create profile on signup ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  -- Promote the very first user to admin (bootstrap).
  if not exists (select 1 from public.profiles where role = 'admin') then
    update public.profiles set role = 'admin' where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Trigger: order status change notifications ----------
create or replace function public.notify_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status in ('completed', 'cancelled', 'refunded', 'failed', 'partial') then
    insert into public.notifications (user_id, type, title, body, link)
    values (
      new.user_id,
      case
        when new.status = 'completed' then 'order_completed'::notification_type
        when new.status = 'cancelled' then 'order_cancelled'::notification_type
        else 'order_status'::notification_type
      end,
      'Order #' || new.order_number || ' is now ' || new.status,
      'Your order for service ' || coalesce((select s.name from public.services s where s.id = new.service_id), '') || ' has been updated.',
      '/orders/' || new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_order_status_change on public.orders;
create trigger on_order_status_change
  after update of status on public.orders
  for each row execute function public.notify_order_status_change();

-- ---------- Trigger: ticket reply notifications ----------
create or replace function public.notify_ticket_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.tickets where id = new.ticket_id;

  if new.is_staff then
    insert into public.notifications (user_id, type, title, body, link)
    values (v_owner, 'ticket_reply', 'New reply on ticket', 'Support replied to your ticket.', '/support/' || new.ticket_id);
  else
    -- notify all admins
    insert into public.notifications (user_id, type, title, body, link)
    select id, 'ticket_reply', 'New message on ticket', 'A user replied to a support ticket.', '/admin/support/' || new.ticket_id
    from public.profiles where role = 'admin';
  end if;

  update public.tickets set last_message_at = now(), status = case when new.is_staff then 'open' else 'waiting' end where id = new.ticket_id;
  return new;
end;
$$;

drop trigger if exists on_ticket_message on public.ticket_messages;
create trigger on_ticket_message
  after insert on public.ticket_messages
  for each row execute function public.notify_ticket_reply();

-- ============================================================
-- Payment approval / rejection (atomic, admin only)
-- ============================================================

create or replace function public.approve_payment(p_id uuid, admin_id uuid, p_note text default null)
returns public.payment_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payment_requests;
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

  return v_payment;
end;
$$;

create or replace function public.reject_payment(p_id uuid, admin_id uuid, p_reason text default null)
returns public.payment_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payment_requests;
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
    set status = 'rejected', processed_by = admin_id, processed_at = now(), admin_note = coalesce(p_reason, admin_note)
    where id = p_id;

  insert into public.notifications (user_id, type, title, body, link)
  values (v_payment.user_id, 'payment_rejected', 'Payment Rejected', 'Your ' || v_payment.method || ' deposit was rejected' || case when p_reason is not null then ': ' || p_reason else '.' end, '/dashboard/add-funds');

  insert into public.logs (user_id, action, entity_type, entity_id, description)
  values (admin_id, 'reject', 'payment_requests', p_id::text, 'Rejected payment request ' || p_id::text || coalesce(' - ' || p_reason, ''));

  return v_payment;
end;
$$;

-- ============================================================
-- Balance adjustment (admin)
-- ============================================================

create or replace function public.adjust_balance(target_user_id uuid, amount numeric, description text, admin_id uuid, tx_type public.transaction_type default 'adjustment')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = admin_id and role = 'admin') then
    raise exception 'Forbidden';
  end if;

  if amount < 0 then
    update public.profiles set balance = balance + amount where id = target_user_id and balance + amount >= 0;
    if not found then
      raise exception 'Insufficient balance';
    end if;
  else
    update public.profiles set balance = balance + amount where id = target_user_id;
  end if;

  insert into public.transactions (user_id, type, amount, balance_after, description, reference_type, meta)
  select target_user_id, tx_type, amount, balance, coalesce(description, 'Balance adjustment'), 'profiles', jsonb_build_object('admin_id', admin_id)
  from public.profiles where id = target_user_id;

  insert into public.logs (user_id, action, entity_type, entity_id, description, meta)
  values (admin_id, 'balance_adjust', 'profiles', target_user_id::text, coalesce(description, 'Balance adjustment'), jsonb_build_object('amount', amount));
end;
$$;

-- ============================================================
-- Order payment (server-side deduction)
-- ============================================================

create or replace function public.deduct_order_cost(p_order_id uuid)
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

-- ============================================================
-- Coupon validation helper
-- ============================================================

create or replace function public.get_coupon(p_code text)
returns public.coupons
language sql
security definer
set search_path = public
stable
as $$
  select * from public.coupons
  where upper(code) = upper(p_code)
    and is_active = true
    and (usage_limit is null or used_count < usage_limit)
    and (starts_at is null or starts_at <= now())
    and (expires_at is null or expires_at > now())
  limit 1;
$$;

grant execute on function public.is_admin() to authenticated, anon;
grant execute on function public.current_profile() to authenticated;
grant execute on function public.is_banned() to authenticated;
grant execute on function public.get_coupon(text) to authenticated;
grant execute on function public.deduct_order_cost(uuid) to authenticated;
grant execute on function public.approve_payment(uuid, uuid, text) to authenticated;
grant execute on function public.reject_payment(uuid, uuid, text) to authenticated;
grant execute on function public.adjust_balance(uuid, numeric, text, uuid, public.transaction_type) to authenticated;

-- ============================================================
-- Seed data
-- ============================================================

insert into public.settings (key, value, is_public) values
  ('site', '{"name":"BD Cheap SMM","tagline":"Cheap & reliable SMM panel in Bangladesh","logo":null,"favicon":null}'::jsonb, true),
  ('general', '{"currency":"BDT","timezone":"Asia/Dhaka","maintenance_mode":false}'::jsonb, true),
  ('payments', '{"bKash":"","nagad":"","rocket":""}'::jsonb, true),
  ('seo', '{"title":"BD Cheap SMM - Buy Cheap SMM Services","description":"Buy Facebook, Instagram, YouTube, TikTok followers & likes at the cheapest rates in Bangladesh.","keywords":"smm, panel, bd cheap smm, followers, likes"}'::jsonb, true),
  ('footer', '{"text":"© {year} BD Cheap SMM. All rights reserved.","links":[]}'::jsonb, true),
  ('email', '{"sender_name":"BD Cheap SMM"}'::jsonb, false)
on conflict (key) do nothing;

insert into public.categories (name, slug, description, icon, sort_order) values
  ('Instagram', 'instagram', 'Instagram followers, likes, views & comments', 'Instagram', 1),
  ('Facebook', 'facebook', 'Facebook page likes, post likes & followers', 'Facebook', 2),
  ('YouTube', 'youtube', 'YouTube subscribers, views & likes', 'Youtube', 3),
  ('TikTok', 'tiktok', 'TikTok followers, views & likes', 'Music2', 4),
  ('Twitter / X', 'twitter', 'Twitter followers, retweets & likes', 'Twitter', 5),
  ('Telegram', 'telegram', 'Telegram members & views', 'Send', 6),
  ('WhatsApp', 'whatsapp', 'WhatsApp group members', 'MessageCircle', 7),
  ('Spotify', 'spotify', 'Spotify plays & followers', 'Headphones', 8)
on conflict (slug) do nothing;

insert into public.providers (name, api_url, api_key, api_key_encrypted, status, priority)
values ('SMMFollow', '', '', true, 'inactive', 1)
on conflict do nothing;
