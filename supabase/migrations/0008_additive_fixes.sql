-- ============================================================
-- BD Cheap SMM - Additive production fixes
--
-- Safe to run on any deployed database (all statements are idempotent).
--  1. Self-heal columns the app relies on (heals deployed-DB drift).
--  2. DB-side unique ticket numbers (TKT-YYYYMMDD-NNNN).
--  3. Re-create atomic ticket create/reply RPCs + reply notifications.
--  4. Re-create approve/reject payment RPCs (exactly-once credit).
--  5. Re-create order charge/refund/coupon/notification functions.
--  6. Re-assert storage buckets & policies and settings seed.
--  7. Remove the first-user bootstrap that auto-promoted signups to admin.
-- ============================================================

-- ---------- 1. Self-healing schema (deployed-DB drift) ----------
alter table public.services
  add column if not exists pricing_mode text not null default 'global';
alter table public.services
  add column if not exists profit_margin numeric(6, 2) not null default 0;
alter table public.services
  add column if not exists provider_price numeric(12, 2);
alter table public.services
  add column if not exists meta jsonb not null default '{}'::jsonb;
alter table public.services
  add column if not exists is_featured boolean not null default false;
alter table public.services
  add column if not exists is_favorite boolean not null default false;

alter table public.profiles
  add column if not exists currency text not null default 'BDT';
alter table public.orders
  add column if not exists currency text not null default 'BDT';
alter table public.orders
  add column if not exists error_message text;
alter table public.orders
  add column if not exists provider_response jsonb;

alter table public.ticket_messages
  add column if not exists is_staff boolean not null default false;
alter table public.tickets
  add column if not exists last_message_at timestamptz;
alter table public.tickets
  add column if not exists assigned_to uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'services_pricing_mode_check'
      and conrelid = 'public.services'::regclass
  ) then
    alter table public.services
      add constraint services_pricing_mode_check
      check (pricing_mode in ('global', 'custom'));
  end if;
end $$;

-- ---------- 2. DB-side unique ticket numbers ----------
create sequence if not exists public.ticket_number_seq;

create or replace function public.next_ticket_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  return 'TKT-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.ticket_number_seq')::text, 4, '0');
end;
$$;

grant execute on function public.next_ticket_number() to authenticated;

-- ---------- 3. Atomic create ticket + first message ----------
-- Keeps the same 5-argument signature so the app works before and after this
-- migration is applied, but the ticket number is now generated server-side by
-- a sequence (unique, never collides) instead of trusting the client.
create or replace function public.create_ticket_with_message(
  p_ticket_number text,
  p_subject text,
  p_priority text,
  p_category text,
  p_message text
)
returns public.tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ticket public.tickets;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.tickets (ticket_number, user_id, subject, priority, category, status, last_message_at)
  values (public.next_ticket_number(), v_uid, p_subject, coalesce(nullif(p_priority, ''), 'normal'), p_category, 'open', now())
  returning * into v_ticket;

  insert into public.ticket_messages (ticket_id, user_id, message, is_staff)
  values (v_ticket.id, v_uid, p_message, false);

  return v_ticket;
end;
$$;

grant execute on function public.create_ticket_with_message(text, text, text, text, text) to authenticated;

-- ---------- 3b. Reply / new message on an existing ticket ----------
create or replace function public.create_ticket_message(
  p_ticket_id uuid,
  p_message text,
  p_is_staff boolean default false
)
returns public.ticket_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ticket public.tickets;
  v_msg public.ticket_messages;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_ticket from public.tickets where id = p_ticket_id;
  if not found then
    raise exception 'Ticket not found';
  end if;

  if p_is_staff then
    if not public.is_admin() then
      raise exception 'Forbidden';
    end if;
  else
    if v_ticket.user_id <> v_uid then
      raise exception 'Forbidden';
    end if;
    if v_ticket.status = 'closed' then
      raise exception 'Ticket is closed';
    end if;
  end if;

  insert into public.ticket_messages (ticket_id, user_id, message, is_staff)
  values (p_ticket_id, v_uid, p_message, p_is_staff)
  returning * into v_msg;

  update public.tickets
    set last_message_at = now(),
        status = case when p_is_staff then 'open' else 'waiting' end
  where id = p_ticket_id;

  return v_msg;
end;
$$;

grant execute on function public.create_ticket_message(uuid, text, boolean) to authenticated;

-- ---------- 3c. Ticket reply notifications ----------
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

-- ---------- 3d. Re-assert ticket_messages insert policies ----------
drop policy if exists "tm_insert_own" on public.ticket_messages;
create policy "tm_insert_own" on public.ticket_messages
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.tickets t where t.id = ticket_id and t.user_id = auth.uid())
  );

drop policy if exists "tm_insert_admin" on public.ticket_messages;
create policy "tm_insert_admin" on public.ticket_messages
  for insert with check (public.is_admin());

-- ---------- 4. Payment approval / rejection (atomic, exactly-once credit) ----------
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

-- ---------- 5. Order charge / refund / coupon / notification helpers ----------
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

  if not public.is_admin() and v_order.user_id <> auth.uid() then
    raise exception 'Forbidden';
  end if;

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

-- ---------- 6. Storage buckets & policies ----------
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "payment_proofs_read_own" on storage.objects;
create policy "payment_proofs_read_own" on storage.objects
  for select using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = 'payments'
    and (
      (select owner from storage.objects o where o.id = objects.id) = auth.uid()
      or public.is_admin()
    )
  );

drop policy if exists "payment_proofs_upload" on storage.objects;
create policy "payment_proofs_upload" on storage.objects
  for insert with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = 'payments'
    and (storage.filename(name)) like auth.uid()::text || '-%'
  );

drop policy if exists "avatars_read_public" on storage.objects;
create policy "avatars_read_public" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_upload" on storage.objects;
create policy "avatars_upload" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (name) like auth.uid()::text || '-%'
  );

-- ---------- 7. Settings seed (missing rows) ----------
insert into public.settings (key, value, is_public) values
  ('site', '{"name":"BD Cheap SMM","tagline":"Cheap & reliable SMM panel in Bangladesh","logo":null,"favicon":null}'::jsonb, true),
  ('general', '{"currency":"BDT","timezone":"Asia/Dhaka","maintenance_mode":false}'::jsonb, true),
  ('payments', '{"bKash":"","nagad":"","rocket":""}'::jsonb, true),
  ('seo', '{"title":"BD Cheap SMM - Buy Cheap SMM Services","description":"Buy Facebook, Instagram, YouTube, TikTok followers & likes at the cheapest rates in Bangladesh.","keywords":"smm, panel, bd cheap smm, followers, likes"}'::jsonb, true),
  ('footer', '{"text":"© {year} BD Cheap SMM. All rights reserved.","links":[]}'::jsonb, true),
  ('email', '{"sender_name":"BD Cheap SMM"}'::jsonb, false)
on conflict (key) do nothing;

-- ---------- 8. Realtime (idempotent) ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ticket_messages'
  ) then
    alter publication supabase_realtime add table public.ticket_messages;
  end if;
end $$;

-- ---------- 9. handle_new_user: no bootstrap auto-promotion ----------
drop trigger if exists on_auth_user_created on auth.users;

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

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Grants ----------
grant execute on function public.create_ticket_with_message(text, text, text, text, text) to authenticated;
grant execute on function public.create_ticket_message(uuid, text, boolean) to authenticated;
grant execute on function public.approve_payment(uuid, uuid, text) to authenticated;
grant execute on function public.reject_payment(uuid, uuid, text) to authenticated;
grant execute on function public.deduct_order_cost(uuid, uuid) to authenticated;
grant execute on function public.refund_order(uuid, uuid) to authenticated;
grant execute on function public.create_notification(uuid, public.notification_type, text, text, text) to authenticated;
grant execute on function public.get_coupon(text) to authenticated;
grant execute on function public.use_coupon(uuid, uuid, numeric, text, text) to authenticated;
grant execute on function public.next_ticket_number() to authenticated;
