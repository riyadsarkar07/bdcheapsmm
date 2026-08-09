-- ============================================================
-- BD Cheap SMM - Realtime, storage buckets & indexes
-- ============================================================

-- ---------- Realtime ----------
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.ticket_messages;

-- ---------- Storage buckets ----------
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Payment proofs: users may upload & read their own; admins may read all.
create policy "payment_proofs_read_own" on storage.objects
  for select using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = 'payments'
    and (
      (select owner from storage.objects o where o.id = objects.id) = auth.uid()
      or public.is_admin()
    )
  );

create policy "payment_proofs_upload" on storage.objects
  for insert with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = 'payments'
    and (storage.filename(name)) like auth.uid()::text || '-%'
  );

-- Avatars: public read, authenticated upload.
create policy "avatars_read_public" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_upload" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (name) like auth.uid()::text || '-%'
  );

-- ---------- Extra indexes ----------
create index if not exists idx_services_name_trgm on public.services using gin (name gin_trgm_ops);
create extension if not exists pg_trgm;

create index if not exists idx_payment_created on public.payment_requests (created_at desc);
create index if not exists idx_tickets_created on public.tickets (created_at desc);
create index if not exists idx_notifications_created on public.notifications (created_at desc);
create index if not exists idx_logs_action on public.logs (action);
create index if not exists idx_api_keys_user on public.api_keys (user_id);
create index if not exists idx_orders_provider_status on public.orders (provider_id, status);
