create table public.customer_settings (
 user_id uuid not null references public.profiles on delete cascade,
 key text not null check(length(key) between 1 and 100),
 value jsonb not null check(octet_length(value::text)<=65536),
 primary key(user_id,key)
);
alter table public.customer_settings enable row level security;
create policy own_settings on public.customer_settings for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert,update,delete on public.customer_settings to authenticated;

alter table public.payment_requests add column resume_service uuid references public.services on delete set null,
 add column correction_reason text, add column correction_history jsonb not null default '[]',
 add column help_ticket uuid references public.tickets on delete set null;
create unique index payment_method_reference on public.payment_requests(lower(method), upper(trim(transaction_id)));
create function public.payment_revision_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if old.correction_reason is not null and new.status='approved' then raise exception 'Customer correction pending'; end if;
 if new.correction_reason is distinct from old.correction_reason then
   new.correction_history:=old.correction_history||jsonb_build_array(jsonb_build_object('at',now(),'reason',old.correction_reason,'next_reason',new.correction_reason,'old_tx',old.transaction_id,'old_sender',old.sender_number,'old_amount',old.amount));
 end if;
 return new;
end $$;
create trigger payment_revision_guard before update on public.payment_requests for each row execute function public.payment_revision_guard();
create function public.deposit_help(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.payment_requests; t public.tickets;
begin
 select * into strict p from public.payment_requests where id=p_id and user_id=auth.uid() for update;
 if exists(select 1 from public.tickets where id=p.help_ticket and status<>'closed') then return p.help_ticket; end if;
 select * into t from public.create_ticket_with_message('DEP-'||gen_random_uuid()::text,'Deposit help · '||p.method,'normal','Payment',
 concat_ws(' · ',p.method,p.transaction_id,p.amount||' '||p.currency,to_char(p.created_at at time zone 'Asia/Dhaka','YYYY-MM-DD HH24:MI')||' Dhaka',p.status));
 update public.payment_requests set help_ticket=t.id where id=p.id;
 return t.id;
end $$;
revoke all on function public.deposit_help(uuid) from public,anon;
grant execute on function public.deposit_help(uuid) to authenticated;

alter table public.orders add column completed_at timestamptz, add column provider_refill_id text,
 add column provider_refill_status text, add column refill_checked_at timestamptz;
create function public.track_order_completion() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='completed' and old.status<>'completed' then new.completed_at:=now(); end if;
 return new;
end $$;
create trigger order_completion before update of status on public.orders for each row execute function public.track_order_completion();
create index service_completion_window on public.orders(service_id,completed_at desc) where completed_at is not null;
create function public.delivery_sample(p_service uuid) returns table(samples bigint,minutes numeric)
language sql stable security definer set search_path='' as $$
 select count(*),case when count(*)>=5 then round((percentile_cont(0.5) within group(order by extract(epoch from (completed_at-created_at))/60))::numeric) end
 from public.orders where service_id=p_service and status='completed' and completed_at>=now()-interval '30 days';
$$;
revoke all on function public.delivery_sample(uuid) from public,anon;
grant execute on function public.delivery_sample(uuid) to authenticated;

create table public.refill_reminders(order_id uuid primary key references public.orders on delete cascade,
 user_id uuid not null references public.profiles on delete cascade,deadline timestamptz not null,sent_at timestamptz);
alter table public.refill_reminders enable row level security;
create policy read_reminder on public.refill_reminders for select to authenticated using(user_id=auth.uid());
grant select on public.refill_reminders to authenticated;
revoke insert,update,delete on public.refill_reminders from authenticated,anon;
create function public.deliver_refill_reminders() returns void language sql set search_path='' as $$
 with due as(update public.refill_reminders r set sent_at=now() from public.orders o
 where r.sent_at is null and r.deadline>now() and r.deadline<=now()+interval '24 hours' and o.id=r.order_id
 and o.status in ('partial','completed') and coalesce(o.refill_count,0)<2 returning r.user_id,r.order_id)
 insert into public.notifications(user_id,title,body,link) select user_id,'Refill window ends soon','Check your order before the confirmed refill deadline.','/orders/'||order_id from due;
$$;
revoke all on function public.deliver_refill_reminders() from public,authenticated,anon;
grant execute on function public.deliver_refill_reminders() to service_role;
create function public.my_payment_reference(p_method text,p_tx text) returns uuid language sql stable set search_path='' as $$
 select id from public.payment_requests where user_id=auth.uid() and lower(method)=lower(p_method) and upper(trim(transaction_id))=upper(trim(p_tx)) limit 1
$$;
revoke all on function public.my_payment_reference(text,text) from public,anon;
grant execute on function public.my_payment_reference(text,text) to authenticated;

create function public.monthly_order_statement(p_month date)
returns table(project text,order_number text,posted timestamptz,entry text,amount numeric,currency text)
language sql stable set search_path='' as $$
 select coalesce(nullif(n.note,''),'Unassigned'),o.order_number,t.created_at,t.type::text,t.amount,t.currency
 from public.transactions t join public.orders o on o.id=t.reference_id and o.user_id=t.user_id
 left join public.order_notes n on n.order_id=o.id
 where t.user_id=auth.uid() and t.reference_type='orders' and t.type in ('order_deduction','refund')
 and t.created_at>=date_trunc('month',p_month::timestamp) at time zone 'Asia/Dhaka'
 and t.created_at<(date_trunc('month',p_month::timestamp)+interval '1 month') at time zone 'Asia/Dhaka'
 order by 1,t.created_at,t.id
$$;
revoke all on function public.monthly_order_statement(date) from public,anon;
grant execute on function public.monthly_order_statement(date) to authenticated;
create function public.today_wallet_spend(p_currency text) returns numeric language sql stable set search_path='' as $$
 select coalesce(sum(abs(amount)),0) from public.transactions
 where user_id=auth.uid() and type='order_deduction' and currency=p_currency
 and created_at>=date_trunc('day',now() at time zone 'Asia/Dhaka') at time zone 'Asia/Dhaka'
$$;
revoke all on function public.today_wallet_spend(text) from public,anon;
grant execute on function public.today_wallet_spend(text) to authenticated;
alter table public.orders add column refill_claimed_at timestamptz;
alter table public.payment_requests add column resume_draft jsonb;
;
