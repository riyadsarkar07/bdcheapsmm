-- Save the merchant number that applied at submission, even if settings change later.
alter table public.payment_requests add column merchant_number text;
create function public.capture_deposit_merchant() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 select nullif(value->>new.method,'') into new.merchant_number from public.settings where key='payments';
 return new;
end $$;
create trigger capture_deposit_merchant before insert on public.payment_requests for each row execute function public.capture_deposit_merchant();

create or replace function public.deposit_help(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.payment_requests; t public.tickets;
begin
 select * into strict p from public.payment_requests where id=p_id and user_id=auth.uid() for update;
 if exists(select 1 from public.tickets where id=p.help_ticket and status<>'closed') then return p.help_ticket; end if;
 select * into t from public.create_ticket_with_message('DEP-'||gen_random_uuid()::text,'Deposit help · '||p.method,'normal','Payment',
 concat_ws(' · ',p.method,'Merchant '||coalesce(p.merchant_number,'unrecorded'),p.transaction_id,p.amount||' '||p.currency,to_char(p.created_at at time zone 'Asia/Dhaka','YYYY-MM-DD HH24:MI')||' Dhaka',p.status));
 update public.payment_requests set help_ticket=t.id where id=p.id;
 return t.id;
end $$;

-- Compare revisions before saving a shared batch so another device cannot overwrite it.
create function public.save_order_batch(p_id uuid,p_version integer,p_batch jsonb) returns integer
language plpgsql set search_path='' as $$
declare v integer:=p_version+1;
begin
 if p_version<0 or jsonb_typeof(p_batch)<>'object' or jsonb_array_length(p_batch->'rows') not between 1 and 10 then raise exception 'Invalid batch';end if;
 if p_version=0 then
  insert into public.customer_settings(user_id,key,value) values(auth.uid(),'batch:'||p_id,p_batch||jsonb_build_object('version',v))
  on conflict do nothing;
 else
  update public.customer_settings set value=p_batch||jsonb_build_object('version',v) where user_id=auth.uid() and key='batch:'||p_id and (value->>'version')::integer=p_version;
 end if;
 if not found then raise exception 'Batch changed on another device';end if;
 return v;
end $$;
revoke all on function public.save_order_batch(uuid,integer,jsonb) from public,anon;
grant execute on function public.save_order_batch(uuid,integer,jsonb) to authenticated;
;
