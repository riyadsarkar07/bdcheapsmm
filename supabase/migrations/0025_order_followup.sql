alter table public.orders add column checkout_terms jsonb;

create function public.capture_checkout_terms() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='UPDATE' then
    new.checkout_terms := old.checkout_terms;
  else
    select jsonb_build_object(
      'service',s.name,'rate_usd',s.price,'quantity',new.quantity,'price',new.price,
      'currency',new.currency,'refill',s.meta->'refill','description',s.description
    ) into new.checkout_terms from public.services s where s.id=new.service_id;
  end if;
  return new;
end;
$$;
create trigger capture_order_terms before insert or update of checkout_terms on public.orders
for each row execute function public.capture_checkout_terms();

create index if not exists logs_refill_followup on public.logs(entity_id,created_at desc)
where entity_type='orders' and action='order_refill';
create index if not exists tickets_customer_followup on public.tickets(user_id,last_message_at desc) where status<>'closed';

create function public.orders_needing_attention()
returns table(order_id uuid, issue text, ticket_id uuid)
language sql stable security definer set search_path='' as $$
 select o.id,
   case when thread.id is not null then 'Support replied'
        when o.status in ('failed','rejected') and o.error_message ~* '(link|url)' then 'Check target link'
        when refill.description='Provider declined the refill request.' then 'Refill declined'
        else 'Review failed order' end,
   thread.id
 from public.orders o
 left join lateral (
   select t.id from public.tickets t
   where t.user_id=o.user_id and t.status<>'closed' and
     (starts_with(t.subject,'Order #'||o.order_number||' —') or exists
       (select 1 from public.order_drop_reports d where d.ticket_id=t.id and d.order_id=o.id))
     and (select m.is_staff from public.ticket_messages m where m.ticket_id=t.id order by m.created_at desc,m.id desc limit 1)
   order by t.last_message_at desc limit 1
 ) thread on true
 left join lateral (
   select l.description from public.logs l where l.entity_type='orders' and l.entity_id=o.id::text
     and l.action='order_refill' order by l.created_at desc,l.id desc limit 1
 ) refill on true
 where o.user_id=auth.uid() and (thread.id is not null or o.status in ('failed','rejected')
   or (o.status in ('completed','partial') and refill.description='Provider declined the refill request.'));
$$;
revoke all on function public.orders_needing_attention() from public,anon;
grant execute on function public.orders_needing_attention() to authenticated;
create view public.customer_action_orders with(security_invoker=true) as
select i.*,a.issue,a.ticket_id from public.orders_needing_attention() a join public.customer_order_index i on i.id=a.order_id;
revoke all on public.customer_action_orders from public,anon;
grant select on public.customer_action_orders to authenticated;
