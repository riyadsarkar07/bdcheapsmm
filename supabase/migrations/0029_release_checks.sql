create table public.order_poll_schedule (
 order_id uuid primary key references public.orders(id) on delete cascade,
 next_check timestamptz not null
);
alter table public.order_poll_schedule enable row level security;
revoke all on public.order_poll_schedule from anon,authenticated;

create function public.claim_order_checks() returns table(id uuid,provider_id uuid,provider_order_id text,status public.order_status,start_count integer,remain integer)
language sql set search_path='' as $$
 with candidates as materialized (
   select o.id,o.provider_id,o.provider_order_id,o.status,o.start_count,o.remain
   from public.orders o left join public.order_poll_schedule q on q.order_id=o.id
   where o.status in ('pending','processing','in_progress') and o.provider_order_id is not null and o.provider_id is not null
     and (q.next_check is null or q.next_check<=now())
   order by q.next_check nulls first,o.created_at,o.id limit 3 for update of o skip locked
 ), claimed as (
   insert into public.order_poll_schedule as q(order_id,next_check)
   select c.id,now()+interval '9 minutes' from candidates c
   on conflict(order_id) do update set next_check=excluded.next_check where q.next_check<=now() returning order_id
 ) select c.* from candidates c join claimed q on q.order_id=c.id;
$$;
revoke all on function public.claim_order_checks() from public,anon,authenticated;
grant execute on function public.claim_order_checks() to service_role;
create or replace function public.deposit_help(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.payment_requests; t public.tickets;
begin
 select * into strict p from public.payment_requests where id=p_id and user_id=auth.uid() for update;
 if exists(select 1 from public.tickets where id=p.help_ticket and user_id=p.user_id and status<>'closed') then return p.help_ticket; end if;
 select * into t from public.create_ticket_with_message('DEP-'||gen_random_uuid()::text,'Deposit help · '||p.method,'normal','Payment',
 concat_ws(' · ',p.method,'Merchant '||coalesce(p.merchant_number,'unrecorded'),p.transaction_id,p.amount||' '||p.currency,to_char(p.created_at at time zone 'Asia/Dhaka','YYYY-MM-DD HH24:MI')||' Dhaka',p.status));
 update public.payment_requests set help_ticket=t.id where id=p.id;
 return t.id;
end $$;


-- Keep the latest provider-supplied flags so a missing service can be distinguished from an explicit false.
create table public.refill_catalog_evidence (
 provider_id uuid primary key references public.providers(id) on delete cascade,
 checked_at timestamptz not null, flags jsonb not null
);
alter table public.refill_catalog_evidence enable row level security;
revoke all on public.refill_catalog_evidence from anon,authenticated;
create or replace function public.sync_refill_flags(p_provider uuid, p_flags jsonb, p_checked_at timestamptz)
returns integer language plpgsql set search_path = public as $$
declare
  changed integer;
begin
  perform id from providers where id = p_provider and
    (refill_checked_at is null or refill_checked_at < p_checked_at) for update;
  if not found then return 0; end if;
  update services s
  set meta = jsonb_set(coalesce(s.meta, '{}'::jsonb), '{refill}', f.value)
  from jsonb_each(p_flags) f
  where s.provider_id = p_provider and s.provider_service_id = f.key
    and jsonb_typeof(f.value) = 'boolean'
    and lower(s.meta->>'refill') is distinct from (f.value #>> '{}');
  get diagnostics changed = row_count;
  insert into public.refill_catalog_evidence(provider_id,checked_at,flags)
  values(p_provider,p_checked_at,p_flags) on conflict(provider_id) do update
  set checked_at=excluded.checked_at,flags=excluded.flags;
  update providers set refill_checked_at = p_checked_at where id = p_provider;
  return changed;
end;
$$;
