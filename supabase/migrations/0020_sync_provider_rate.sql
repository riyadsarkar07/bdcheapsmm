-- Keep provider_price in sync with the live catalog and never store 0/invalid
-- rates as a real cost. Replaces sync_provider_services / apply_global_profit
-- in place. Custom-price services keep their selling price. Does not rewrite
-- historical orders. Preserve 0019_order_provider_cost.sql.

create or replace function public.apply_global_profit(p_percentage numeric, p_rounding text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  update public.services
  set price = case p_rounding
        when 'round' then round(provider_price * (1 + p_percentage / 100.0))
        when 'ceil'  then ceil(provider_price * (1 + p_percentage / 100.0))
        else round(provider_price * (1 + p_percentage / 100.0), 2)
      end,
      profit_margin = p_percentage
  where pricing_mode = 'global'
    and provider_price is not null
    and provider_price > 0;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.sync_provider_services(p_provider_id uuid, p_items jsonb)
returns table(imported bigint, updated bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_cat_id uuid;
  v_provider_price numeric;
  v_existing_id uuid;
  v_imported bigint := 0;
  v_updated bigint := 0;
  v_service_id text;
  v_rate_text text;
  v_margin numeric;
  v_rounding text;
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;
  if not exists (select 1 from public.providers where id = p_provider_id) then
    raise exception 'Provider not found';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_service_id := nullif(trim(v_item ->> 'service'), '');
    if v_service_id is null then
      continue;
    end if;

    v_rate_text := nullif(trim(v_item ->> 'rate'), '');
    v_provider_price := null;
    if v_rate_text is not null then
      begin
        v_provider_price := round(v_rate_text::numeric, 2);
      exception when others then
        v_provider_price := null;
      end;
    end if;
    if v_provider_price is null or v_provider_price <= 0 then
      continue;
    end if;

    select id into v_cat_id
    from public.categories
    where slug = coalesce(nullif(v_item ->> 'category_slug', ''), 'general')
    limit 1;

    if v_cat_id is null then
      insert into public.categories (name, slug, description)
      values (
        coalesce(v_item ->> 'category', 'General'),
        coalesce(nullif(v_item ->> 'category_slug', ''), 'general'),
        'Auto-imported category: ' || coalesce(v_item ->> 'category', 'General')
      )
      returning id into v_cat_id;
    end if;

    v_margin := coalesce(nullif(v_item ->> 'profit_margin', '')::numeric, 20);
    v_rounding := coalesce(nullif(v_item ->> 'rounding', ''), 'round2');

    select id into v_existing_id
    from public.services
    where provider_id = p_provider_id
      and provider_service_id = v_service_id
    limit 1;

    if v_existing_id is null then
      insert into public.services (
        provider_id, provider_service_id, name, slug, description, category_id,
        provider_price, min_quantity, max_quantity, average_time, type, meta,
        price, profit_margin, pricing_mode, is_active
      ) values (
        p_provider_id,
        v_service_id,
        v_item ->> 'name',
        p_provider_id::text || '-' || v_service_id,
        nullif(v_item ->> 'description', ''),
        v_cat_id,
        v_provider_price,
        coalesce((v_item ->> 'min')::int, 1),
        coalesce((v_item ->> 'max')::int, 100),
        nullif(v_item ->> 'average_time', ''),
        nullif(v_item ->> 'type', ''),
        jsonb_build_object(
          'provider_category', v_item ->> 'category',
          'refill', v_item ->> 'refill',
          'cancel', v_item ->> 'cancel',
          'driptype', v_item ->> 'driptype'
        ),
        case v_rounding
          when 'round' then round(v_provider_price * (1 + v_margin / 100.0))
          when 'ceil' then ceil(v_provider_price * (1 + v_margin / 100.0))
          else round(v_provider_price * (1 + v_margin / 100.0), 2)
        end,
        v_margin,
        'global',
        true
      );
      v_imported := v_imported + 1;
    else
      update public.services
      set name = v_item ->> 'name',
          description = nullif(v_item ->> 'description', ''),
          provider_price = v_provider_price,
          min_quantity = coalesce((v_item ->> 'min')::int, min_quantity),
          max_quantity = coalesce((v_item ->> 'max')::int, max_quantity),
          average_time = nullif(v_item ->> 'average_time', ''),
          type = nullif(v_item ->> 'type', ''),
          meta = jsonb_build_object(
            'provider_category', v_item ->> 'category',
            'refill', v_item ->> 'refill',
            'cancel', v_item ->> 'cancel',
            'driptype', v_item ->> 'driptype'
          ),
          is_active = true,
          category_id = case when category_id is null then v_cat_id else category_id end,
          price = case
            when pricing_mode = 'custom' then price
            else case coalesce(v_item ->> 'rounding', 'round2')
              when 'round' then round(v_provider_price * (1 + coalesce(profit_margin, 0) / 100.0))
              when 'ceil' then ceil(v_provider_price * (1 + coalesce(profit_margin, 0) / 100.0))
              else round(v_provider_price * (1 + coalesce(profit_margin, 0) / 100.0), 2)
            end
          end
      where id = v_existing_id;
      v_updated := v_updated + 1;
    end if;
  end loop;

  update public.services set is_active = false
  where provider_id = p_provider_id
    and is_active = true
    and provider_service_id not in (
      select nullif(trim(item ->> 'service'), '')
      from jsonb_array_elements(p_items) as item
      where nullif(trim(item ->> 'service'), '') is not null
    );

  return query select v_imported, v_updated;
end;
$$;
