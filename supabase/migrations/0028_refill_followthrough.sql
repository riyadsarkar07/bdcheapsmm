alter table public.orders add column refill_poll_after timestamptz;
create index pending_refill_checks on public.orders(refill_poll_after) where provider_refill_id is not null;

-- Earlier releases recorded confirmed references in the refill activity log.
with latest as (
 select distinct on(entity_id) entity_id,substring(description from '^Provider accepted refill request #([0-9]+)\.$') as reference
 from public.logs where entity_type='orders' and action='order_refill' and description like 'Provider accepted%refill request%'
 order by entity_id,created_at desc,id desc
)
update public.orders o set provider_refill_id=latest.reference from latest
where o.id::text=latest.entity_id and latest.reference is not null and o.provider_refill_id is null;

create or replace function public.deliver_refill_reminders() returns void language sql set search_path='' as $$
 with due as(update public.refill_reminders r set sent_at=now() from public.orders o join public.services s on s.id=o.service_id
 where r.sent_at is null and r.deadline>now() and r.deadline<=now()+interval '24 hours' and o.id=r.order_id
 and o.status in ('partial','completed') and coalesce(o.refill_count,0)<2 and o.refill_claimed_at is null
 and o.provider_order_id is not null and lower(coalesce(s.meta->>'refill','')) not in ('false','no','0')
 and lower(coalesce(o.provider_refill_status,o.provider_response->>'refill_status','')) not in ('in progress','in_progress','processing','submitted','pending')
 and (o.provider_response ?| array['refill_expires_at','refill_deadline','refill_starts_at'])
 returning r.user_id,r.order_id)
 insert into public.notifications(user_id,title,body,link) select user_id,'Refill window ends soon','Check your order before the confirmed refill deadline.','/orders/'||order_id from due;
$$;
;
