-- ============================================================
-- Realtime: stream order status changes
-- ============================================================
-- Required so the user's "My Orders" list updates automatically when the
-- status sync job writes a new provider status to public.orders. RLS still
-- applies: each user only receives events for rows they can select.
alter publication supabase_realtime add table public.orders;
