# Supabase Setup

This guide walks through creating the Supabase project and applying the schema, RLS policies, seed data, and realtime/storage configuration.

## 1. Create a Supabase project

1. Go to https://supabase.com and create an account.
2. Click **New project**, pick a region close to your users, and set a strong database password.
3. Note the **Project URL** and **anon public key** from **Project Settings → API**. The **service_role key** is on the same page — keep it secret.

## 2. Apply migrations

The project ships five ordered migrations in `supabase/migrations/`:

| File                            | Purpose                                        |
| ------------------------------- | ---------------------------------------------- |
| `0001_init.sql`                 | Tables, enums, indexes, triggers               |
| `0002_rls.sql`                  | Row Level Security policies and helper funcs   |
| `0003_seed.sql`                 | Auth trigger, business triggers, seed data     |
| `0004_realtime_storage.sql`     | Realtime publications + storage buckets        |
| `0005_audit_fixes.sql`          | Security hardening (RLS, RPC ownership, refunds) |

### Option A: Supabase CLI (recommended)

Install the CLI and link the project:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
```

Push all migrations:

```bash
npm run db:push
```

### Option B: SQL Editor (no CLI)

For each file, open your project's **SQL Editor**, paste the contents, and click **Run**. Do this in order: `0001`, then `0002`, then `0003`, then `0004`, then `0005`.

## 3. Configure Authentication

### Email + password

**Authentication → Providers → Email** — ensure it is enabled. For a production site, enable **Confirm email** so users must verify their address.

### Google OAuth

1. Create OAuth credentials at https://console.cloud.google.com (OAuth consent screen + OAuth Client ID).
2. Add the redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`.
3. In **Authentication → Providers → Google**, paste the Client ID and Client Secret and enable the provider.

### Site URL

In **Authentication → URL Configuration**:

- **Site URL**: `https://your-production-domain.com` (or `http://localhost:3000` in development)
- **Redirect URLs**: add `https://your-production-domain.com/auth/callback` and `http://localhost:3000/auth/callback`.

## 4. Verify

1. Run `npm run dev`.
2. Register a new account. The **first registered user is automatically promoted to admin** by the `handle_new_user()` trigger.
3. Sign in and open `/admin` — you should see the admin dashboard.

## Notes

- Migrations are idempotent (`create table if not exists`, `on conflict do nothing`) so they can be re-run safely.
- `0004_realtime_storage.sql` enables Realtime for `notifications` and `ticket_messages` and creates the `payment-proofs` and `avatars` storage buckets with RLS.
- `0005_audit_fixes.sql` is a **required** hardening migration: it blocks users from editing their own `balance`/`role`/`status`, adds ownership checks to `deduct_order_cost`, replaces the app-side refund flow with an atomic `refund_order` RPC, adds a security-definer `create_notification`, restricts ticket replies to the ticket owner, and adds `use_coupon` for atomic coupon usage tracking.
- The `SUPABASE_SERVICE_ROLE_KEY` is **required** at runtime for the cron job (`/api/cron/order-status`) and the public API (`/api/smm/v1`); it bypasses RLS, so keep it server-side only.
- The seed data inserts an **inactive SMMFollow provider placeholder**. Set its `api_url` and `api_key` via **Admin → Providers** and activate it when ready.
