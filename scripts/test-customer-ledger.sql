-- All rows belong to synthetic users. The fixture is always rolled back.
begin;
do $$
declare
 customer uuid:=gen_random_uuid(); staff uuid:=gen_random_uuid(); provider uuid:=gen_random_uuid();
 service uuid:=gen_random_uuid(); payment uuid:=gen_random_uuid(); placed public.orders;
 denomination text; starting numeric; expected numeric; help uuid; batch uuid:=gen_random_uuid();
begin
 insert into auth.users(id,email) values(customer, customer||'@example.invalid'),(staff,staff||'@example.invalid');
 update public.profiles set role='admin' where id=staff;
 select currency,balance into strict denomination,starting from public.profiles where id=customer;
 insert into public.providers(id,name,api_url,api_key) values(provider,'Mock provider','https://example.invalid','fixture');
 insert into public.services(id,name,slug,provider_id,provider_service_id,price,min_quantity,max_quantity,meta)
 values(service,'Test R30',service::text,provider,'100',1,10,2000,'{"refill":true}');
 insert into public.payment_requests(id,user_id,method,sender_number,amount,currency,transaction_id,correction_reason)
 values(payment,customer,'bKash','01000000000',252,'BDT',payment::text,'Confirm reference');
 perform set_config('request.jwt.claim.sub',staff::text,true);
 begin
  perform public.approve_payment(payment,staff,null);raise exception 'Expected approval to be blocked';
 exception when others then if sqlerrm<>'Customer correction pending' then raise;end if; end;
 update public.payment_requests set correction_reason=null where id=payment;
 perform set_config('request.jwt.claim.sub',customer::text,true);
 if public.my_payment_reference('bKash',upper(payment::text)) is distinct from payment then raise exception 'Deposit lookup failed';end if;
 begin
  insert into public.payment_requests(user_id,method,sender_number,amount,currency,transaction_id)
    values(customer,'bKash','01000000000',252,'BDT',upper(payment::text));raise exception 'Duplicate reference accepted';
 exception when unique_violation then null;end;
 if public.save_order_batch(batch,0,'{"rows":[{"qty":20}]}')<>1 then raise exception 'Batch revision missing';end if;
 help:=public.deposit_help(payment);
 if public.deposit_help(payment) is distinct from help then raise exception 'Duplicate ticket';end if;
 perform set_config('request.jwt.claim.sub',staff::text,true);
 perform public.approve_payment(payment,staff,null);
 expected:=starting+public.wallet_convert(252,'BDT',denomination);
 select * into placed from public.create_and_charge_order(customer,'TEST-'||service,service,provider,'https://example.invalid/target',1000,1,'',0.5);
 if (select balance from public.profiles where id=customer)<>expected-public.wallet_convert(1,'USD',denomination) then raise exception 'Debit mismatch';end if;
 update public.orders set status='completed',provider_order_id='mock-order',provider_response='{"status":"Completed","remains":0}',remain=0 where id=placed.id;
 update public.orders set provider_refill_id='99',provider_refill_status='Completed',refill_count=1 where id=placed.id;
 if not exists(select from public.orders where id=placed.id and completed_at is not null and provider_refill_id='99') then raise exception 'Receipt missing';end if;
 perform public.refund_order(placed.id,staff);perform public.refund_order(placed.id,staff);
 perform set_config('request.jwt.claim.sub',customer::text,true);
 if (select count(*) from public.monthly_order_statement((now() at time zone 'Asia/Dhaka')::date) where order_number=placed.order_number)<>2 then raise exception 'Statement mismatch';end if;
 if (select balance from public.profiles where id=customer)<>expected or (select count(*) from public.transactions where reference_id=placed.id and type='refund')<>1 then raise exception 'Refund mismatch';end if;
end $$;
rollback;
