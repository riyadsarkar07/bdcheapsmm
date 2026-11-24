alter table public.providers add column refill_checked_at timestamptz;

create function public.sync_refill_flags(p_provider uuid, p_flags jsonb, p_checked_at timestamptz)
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
  update providers set refill_checked_at = p_checked_at where id = p_provider;
  return changed;
end;
$$;
revoke all on function public.sync_refill_flags(uuid,jsonb,timestamptz) from public, anon, authenticated;
grant execute on function public.sync_refill_flags(uuid,jsonb,timestamptz) to service_role;
