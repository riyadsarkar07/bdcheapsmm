-- Run against a disposable database after applying the migrations.
begin;
do $$
declare
  customer uuid := gen_random_uuid();
  provider uuid;
  service uuid;
  placed uuid;
  code text := gen_random_uuid()::text;
  actual numeric;
begin
  insert into auth.users(id,email) values(customer, customer::text || '@example.invalid');
  update public.profiles set balance=1260 where id=customer;
  insert into public.providers(name,api_url,api_key) values('test','test','test') returning id into provider;
  insert into public.services(name,slug,provider_id,price,max_quantity)
    values('test',customer::text,provider,10,1000) returning id into service;
  insert into public.coupons(code,discount_type,discount_value,usage_limit) values(code,'percent',20,1);

  select id into placed from public.create_and_charge_order(customer,code,service,provider,
    'https://example.invalid',1000,8,code,1);
  select balance into actual from public.profiles where id=customer;
  if actual <> 252 then raise exception 'Incorrect discounted BDT debit: %',actual; end if;

  perform public.refund_order(placed,null);
  perform public.refund_order(placed,null);
  select balance into actual from public.profiles where id=customer;
  if actual <> 1260 then raise exception 'Incorrect wallet refund: %',actual; end if;
  if (select count(*) from public.transactions where reference_id=placed and type='refund') <> 1 then
    raise exception 'Expected exactly one refund';
  end if;
  if public.wallet_convert(126,'BDT','USD') <> 1 then raise exception 'Unexpected deposit conversion'; end if;
end;
$$;
rollback;
