create table public.order_notes(
 order_id uuid primary key references public.orders on delete cascade,
 user_id uuid not null references public.profiles on delete cascade,
 note text not null check(length(note)<=160)
);
alter table public.order_notes enable row level security;
create policy "Own project notes" on public.order_notes for all to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid() and exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid()));

create view public.customer_order_index with(security_invoker=true) as
select o.id,o.order_number,o.provider_order_id,o.link,o.status,o.quantity,o.price,o.currency,o.created_at,
 o.provider_response->>'status' as provider_status,s.name as service_name,c.name as category_name,n.note
from public.orders o left join public.services s on s.id=o.service_id left join public.categories c on c.id=s.category_id
left join public.order_notes n on n.order_id=o.id where o.user_id=auth.uid();
grant select on public.customer_order_index to authenticated;

create function public.customer_spending() returns table(category_name text,currency text,spent numeric,refunded numeric)
language sql stable security invoker set search_path='' as $$
 select coalesce(c.name,'Other'),t.currency,sum(case when t.type='order_deduction' then -t.amount else 0 end),
 sum(case when t.type='refund' then t.amount else 0 end)
 from public.transactions t left join public.orders o on t.reference_type='orders' and t.reference_id=o.id
 left join public.services s on s.id=o.service_id left join public.categories c on c.id=s.category_id
 where t.user_id=auth.uid() and t.type in ('order_deduction','refund') and
 t.created_at >= (date_trunc('month',now() at time zone 'Asia/Dhaka') at time zone 'Asia/Dhaka') group by c.name,t.currency
$$;

create table public.drop_updates(
 id uuid primary key, ticket_id uuid not null references public.tickets on delete cascade,
 user_id uuid not null references public.profiles on delete cascade, current_count int, screenshot_path text,
 created_at timestamptz not null default now()
);
alter table public.drop_updates enable row level security;
revoke all on public.drop_updates from anon,authenticated;
grant select on public.drop_updates to authenticated;
create policy "View own drop updates" on public.drop_updates for select to authenticated using(user_id=auth.uid() or public.is_admin());
create index on public.drop_updates(ticket_id,created_at);

create or replace function public.create_drop_report(p_order uuid,p_request uuid,p_count integer,p_path text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  ord public.orders;
  ticket public.tickets;
  existing uuid;
begin
  if uid is null or p_request is null then raise exception 'Login required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,0));
  select ticket_id into existing from public.order_drop_reports where user_id=uid and request_id=p_request;
  if existing is not null then return existing; end if;
  select ticket_id into existing from public.drop_updates where user_id=uid and id=p_request;
  if existing is not null then return existing; end if;
  select * into ord from public.orders where id=p_order and user_id=uid;
  if not found then raise exception 'Order not found'; end if;
  if (p_count is null and p_path is null) or p_count < 0 then raise exception 'Add a count or screenshot'; end if;
  if p_path is not null and (split_part(p_path,'/',1) <> uid::text or not exists (
    select 1 from storage.objects where bucket_id='drop-evidence' and name=p_path and owner=uid
  )) then raise exception 'Screenshot unavailable'; end if;
  if (select count(*) from public.order_drop_reports where user_id=uid and created_at>now()-interval '1 hour') >= 10 then raise exception 'Hourly report limit reached'; end if;
  select t.id into existing from public.order_drop_reports r join public.tickets t on t.id=r.ticket_id
    where r.order_id=p_order and r.user_id=uid and t.status<>'closed' order by r.created_at desc limit 1;
  if existing is not null then
    if (select count(*) from public.drop_updates where user_id=uid and created_at>now()-interval '1 hour') >= 10 then raise exception 'Hourly update limit reached'; end if;
    insert into public.drop_updates(id,ticket_id,user_id,current_count,screenshot_path) values(p_request,existing,uid,p_count,p_path);
    perform public.create_ticket_message(existing,concat_ws(' · ','Drop report update','Count: '||p_count,case when p_path is not null then 'Screenshot attached' end),false);
    return existing;
  end if;
  ticket := public.create_ticket_with_message('', 'Follower drop · #' || ord.order_number, 'normal','Follower drop',
    concat_ws(E'\n','Order #' || ord.order_number,'Provider order ID: ' || ord.provider_order_id,
    'Current count: ' || p_count,case when p_path is not null then 'Screenshot attached' end));
  insert into public.order_drop_reports(ticket_id,order_id,user_id,request_id,current_count,screenshot_path)
  values(ticket.id,p_order,uid,p_request,p_count,p_path);
  return ticket.id;
end;
$$;
create table public.customer_alert_preferences(
 user_id uuid primary key references public.profiles on delete cascade,
 inbox text[] not null default array['orders','wallet','support','catalog'],
 email text[] not null default '{}'
);
alter table public.customer_alert_preferences enable row level security;
create policy "Own alert preferences" on public.customer_alert_preferences for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create table public.customer_email_queue(
 id uuid primary key, user_id uuid not null references public.profiles on delete cascade,
 topic text not null, created_at timestamptz not null default now(), attempts int not null default 0,
 delivered_at timestamptz
);
alter table public.customer_email_queue enable row level security;
revoke all on public.customer_email_queue from authenticated,anon;
grant select,update on public.customer_email_queue to service_role;
create index on public.customer_email_queue(created_at) where delivered_at is null;
create function public.route_customer_alert() returns trigger language plpgsql security definer set search_path='' as $$
declare prefs public.customer_alert_preferences; v_topic text;
begin
 select * into prefs from public.customer_alert_preferences where user_id=new.user_id;
 if not found then return new; end if;
 v_topic := case when new.title='Wallet refund received' then 'wallet' when new.link like '/orders/%' then 'orders' when new.link like '/support/%' then 'support'
 when new.link like '/services/%' then 'catalog' when new.type::text like 'payment_%' or new.link like '/transactions%' then 'wallet' end;
 if v_topic is null then return new; end if;
 if v_topic=any(prefs.email) and not exists(select 1 from public.customer_email_queue where user_id=new.user_id and customer_email_queue.topic=v_topic and created_at>now()-interval '1 hour') then
 insert into public.customer_email_queue(id,user_id,topic) values(new.id,new.user_id,v_topic) on conflict do nothing;
 end if;
 if not(v_topic=any(prefs.inbox)) then return null; end if;
 return new;
end; $$;
create trigger route_customer_notification before insert on public.notifications for each row execute function public.route_customer_alert();

create function public.customer_followup_alert() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='services' then
   insert into public.notifications(user_id,type,title,link) select f.user_id,'system_announcement',new.name || ' is available again','/services/' || new.id from public.favorites f where f.service_id=new.id;
 elsif tg_table_name='transactions' then
   insert into public.notifications(user_id,type,title,body,link) values(new.user_id,'order_status','Wallet refund received',new.amount::text || ' ' || new.currency,'/orders/'||new.reference_id);
 else
   insert into public.notifications(user_id,type,title,body,link) select o.user_id,'order_status','Refill update · #' || o.order_number,new.description,'/orders/'||o.id from public.orders o where o.id::text=new.entity_id::text;
 end if;
 return new;
end; $$;
create trigger customer_service_available after update of is_active on public.services for each row when(new.is_active and not old.is_active) execute function public.customer_followup_alert();
create trigger customer_wallet_refund after insert on public.transactions for each row when(new.type='refund' and new.reference_type='orders') execute function public.customer_followup_alert();
create trigger customer_refill_event after insert on public.logs for each row when(new.action='order_refill' and new.entity_type='orders') execute function public.customer_followup_alert();
-- Only order owners see the selected, customer-facing refill history fields.
create function public.my_refill_activity() returns table(id text,order_id uuid,order_number text,event text,ticket_id uuid,created_at timestamptz)
language sql stable security definer set search_path='' as $$
 select l.id::text,o.id,o.order_number,l.description,null::uuid,l.created_at from public.orders o join public.logs l
 on l.entity_type='orders' and l.entity_id::text=o.id::text and l.action='order_refill' where o.user_id=auth.uid()
 union all select r.ticket_id::text,o.id,o.order_number,'Follower drop reported',r.ticket_id,r.created_at from public.order_drop_reports r
 join public.orders o on o.id=r.order_id where o.user_id=auth.uid()
$$;
revoke all on function public.my_refill_activity() from public,anon;
grant execute on function public.my_refill_activity() to authenticated;
create view public.customer_refill_activity with(security_invoker=true) as select * from public.my_refill_activity();
grant select on public.customer_refill_activity to authenticated;
create function public.service_incident(p_service uuid) returns text
language sql stable security definer set search_path='' as $$
 select case when p.status='inactive' then 'Provider is currently unavailable'
 when h.status='down' and h.last_checked_at>now()-interval '2 hours' then 'Provider recently reported a disruption'
 when h.status='slow' and h.last_checked_at>now()-interval '2 hours' then 'Provider response is delayed' end
 from public.services s join public.providers p on p.id=s.provider_id left join public.provider_health h on h.provider_id=p.id
 where s.id=p_service and s.is_active
$$;
revoke all on function public.service_incident(uuid) from public,anon;
grant execute on function public.service_incident(uuid) to authenticated;
grant select,insert,update,delete on public.order_notes, public.customer_alert_preferences to authenticated;

