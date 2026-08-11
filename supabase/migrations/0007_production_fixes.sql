-- ============================================================
-- BD Cheap SMM - Production hotfixes
--  1. handle_new_user: REMOVE first-user auto-promotion to admin.
--     This was the root cause of "Admin Panel visible to normal
--     users" whenever no admin profile existed: every new signup
--     was promoted to admin. Only an exact, explicit promotion
--     (see README/report SQL for UID d948d2a0-...) may grant admin.
--  2. Atomic ticket creation + messaging RPCs. The old app flow did
--     two separate INSERTs, so the first message could fail after the
--     ticket was created (orphan ticket) or fail on RLS/trigger
--     drift. The new SECURITY DEFINER RPCs run in one transaction,
--     still enforce ownership via auth.uid() (checks are NOT weakened).
--  3. Self-healing schema: ensure columns the app relies on exist
--     even if the deployed DB drifted from the migration chain.
--  4. Re-assert ticket_messages insert policies (idempotent).
-- ============================================================

-- ---------- 1. handle_new_user: drop bootstrap auto-promotion ----------
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

-- ---------- 2. Self-healing schema (deployed-DB drift) ----------
alter table public.ticket_messages add column if not exists is_staff boolean not null default false;
alter table public.profiles add column if not exists currency text not null default 'BDT';
alter table public.orders add column if not exists currency text not null default 'BDT';

-- ---------- 3. Atomic create ticket + first message ----------
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

  insert into public.tickets (ticket_number, user_id, subject, priority, category, status)
  values (p_ticket_number, v_uid, p_subject, coalesce(nullif(p_priority, ''), 'normal'), p_category, 'open')
  returning * into v_ticket;

  insert into public.ticket_messages (ticket_id, user_id, message, is_staff)
  values (v_ticket.id, v_uid, p_message, false);

  return v_ticket;
end;
$$;

grant execute on function public.create_ticket_with_message(text, text, text, text, text) to authenticated;

-- ---------- 4. Reply / new message on an existing ticket ----------
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

-- ---------- 5. Re-assert ticket_messages insert policies (idempotent) ----------
drop policy if exists "tm_insert_own" on public.ticket_messages;
create policy "tm_insert_own" on public.ticket_messages
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.tickets t where t.id = ticket_id and t.user_id = auth.uid())
  );

drop policy if exists "tm_insert_admin" on public.ticket_messages;
create policy "tm_insert_admin" on public.ticket_messages
  for insert with check (public.is_admin());
