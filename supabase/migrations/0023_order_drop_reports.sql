create table public.order_drop_reports (
  ticket_id uuid primary key references public.tickets(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  current_count integer check (current_count >= 0),
  screenshot_path text,
  created_at timestamptz not null default now(),
  unique (user_id, request_id),
  check (current_count is not null or screenshot_path is not null)
);
create index on public.order_drop_reports(order_id);
alter table public.order_drop_reports enable row level security;
revoke all on public.order_drop_reports from anon, authenticated;
grant select on public.order_drop_reports to authenticated;
create policy "Read own reports or review as staff" on public.order_drop_reports
for select to authenticated using (user_id = auth.uid() or public.is_admin());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('drop-evidence','drop-evidence',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy "Upload own drop screenshot" on storage.objects for insert to authenticated
with check (bucket_id='drop-evidence' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "View own or staff drop evidence" on storage.objects for select to authenticated
using (bucket_id='drop-evidence' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));

create function public.create_drop_report(p_order uuid,p_request uuid,p_count integer,p_path text)
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
  select * into ord from public.orders where id=p_order and user_id=uid;
  if not found then raise exception 'Order not found'; end if;
  if (p_count is null and p_path is null) or p_count < 0 then raise exception 'Add a count or screenshot'; end if;
  if p_path is not null and (split_part(p_path,'/',1) <> uid::text or not exists (
    select 1 from storage.objects where bucket_id='drop-evidence' and name=p_path and owner=uid
  )) then raise exception 'Screenshot unavailable'; end if;
  if (select count(*) from public.order_drop_reports where user_id=uid and created_at>now()-interval '1 hour') >= 10 then raise exception 'Hourly report limit reached'; end if;
  ticket := public.create_ticket_with_message('', 'Follower drop · #' || ord.order_number, 'normal','Follower drop',
    concat_ws(E'\n','Order #' || ord.order_number,'Provider order ID: ' || ord.provider_order_id,
    'Current count: ' || p_count,case when p_path is not null then 'Screenshot attached' end));
  insert into public.order_drop_reports(ticket_id,order_id,user_id,request_id,current_count,screenshot_path)
  values(ticket.id,p_order,uid,p_request,p_count,p_path);
  return ticket.id;
end;
$$;
revoke all on function public.create_drop_report(uuid,uuid,integer,text) from public, anon;
grant execute on function public.create_drop_report(uuid,uuid,integer,text) to authenticated;
