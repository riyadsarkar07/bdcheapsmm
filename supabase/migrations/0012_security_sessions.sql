-- ============================================================
-- BD Cheap SMM - Active sessions & suspicious-login security
--
-- Additive + idempotent (safe to run on any deployed database).
--
--  1. Additive enum values: notification_type / log_action gain
--     'security_alert'.
--  2. user_sessions: enrichment registry keyed to GoTrue auth sessions
--     (auth.sessions.id) holding the device/browser/os and approximate
--     location captured from the request headers. RLS: owner-only read /
--     update / delete.
--  3. list_user_sessions(): security-definer read of the caller's own GoTrue
--     sessions joined to user_sessions. Never returns the raw IP.
--  4. revoke_user_session(session_id) / revoke_other_user_sessions(current):
--     security-definer revocation that deletes the targeted GoTrue session
--     (and its refresh tokens) only when it belongs to auth.uid().
--  5. Grants so authenticated users can call the above functions.
-- ============================================================

-- ---------- 1. Additive enum values ----------
alter type public.notification_type add value if not exists 'security_alert';
alter type public.log_action add value if not exists 'security_alert';

-- ---------- 2. user_sessions ----------
create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  auth_session_id uuid,
  user_agent text not null default '',
  browser text,
  os text,
  device text not null default 'Unknown device',
  device_type text not null default 'desktop',
  city text,
  region text,
  country text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_sessions_auth_session_key unique (auth_session_id)
);

create index if not exists idx_user_sessions_user on public.user_sessions (user_id);
create index if not exists idx_user_sessions_user_recent on public.user_sessions (user_id, last_seen_at desc);

alter table public.user_sessions enable row level security;

create policy "user_sessions_select_own" on public.user_sessions
  for select using (auth.uid() = user_id);
create policy "user_sessions_insert_own" on public.user_sessions
  for insert with check (auth.uid() = user_id);
create policy "user_sessions_update_own" on public.user_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_sessions_delete_own" on public.user_sessions
  for delete using (auth.uid() = user_id);

-- ---------- 3. list_user_sessions ----------
-- Lists the caller's own GoTrue sessions enriched with device/location from
-- user_sessions. auth.sessions.user_agent is never authoritative (GoTrue
-- records the server's agent, not the browser's) so the registry value wins.
create or replace function public.list_user_sessions()
returns table (
  id uuid,
  created_at timestamptz,
  last_seen_at timestamptz,
  user_agent text,
  city text,
  region text,
  country text
)
language plpgsql
security definer
stable
set search_path = public, auth
as $$
begin
  return query
    select
      s.id,
      s.created_at,
      greatest(
        coalesce(us.last_seen_at, s.updated_at),
        coalesce(s.updated_at, us.last_seen_at)
      ) as last_seen_at,
      coalesce(us.user_agent, s.user_agent) as user_agent,
      us.city,
      us.region,
      us.country
    from auth.sessions s
    left join public.user_sessions us on us.auth_session_id = s.id
    where s.user_id = auth.uid()
    order by s.updated_at desc
    limit 100;
end;
$$;

-- ---------- 4. revoke_user_session ----------
create or replace function public.revoke_user_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    return false;
  end if;

  delete from public.user_sessions
    where user_id = v_user and auth_session_id = p_session_id;

  if not exists (
    select 1 from auth.sessions s
    where s.id = p_session_id and s.user_id = v_user
  ) then
    return false;
  end if;

  delete from auth.refresh_tokens rt
    where rt.session_id = p_session_id and rt.user_id = v_user;

  delete from auth.sessions s
    where s.id = p_session_id and s.user_id = v_user;

  return true;
end;
$$;

-- ---------- 5. revoke_other_user_sessions ----------
create or replace function public.revoke_other_user_sessions(p_current_session uuid)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_count integer := 0;
begin
  if v_user is null then
    return 0;
  end if;

  select count(*) into v_count
    from auth.sessions s
    where s.user_id = v_user and s.id <> p_current_session;

  delete from auth.refresh_tokens rt
    where rt.user_id = v_user
      and rt.session_id is not null
      and rt.session_id <> p_current_session;

  delete from auth.sessions s
    where s.user_id = v_user and s.id <> p_current_session;

  delete from public.user_sessions
    where user_id = v_user
      and (auth_session_id is null or auth_session_id <> p_current_session);

  return v_count;
end;
$$;

-- ---------- 6. Grants ----------
grant execute on function public.list_user_sessions() to authenticated;
grant execute on function public.revoke_user_session(uuid) to authenticated;
grant execute on function public.revoke_other_user_sessions(uuid) to authenticated;
