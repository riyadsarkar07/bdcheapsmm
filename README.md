# BD Cheap SMM

Production-ready SMM (Social Media Marketing) panel built with **Next.js 15**, **Supabase** and the **SMMFollow** provider API. Sell Instagram, Facebook, YouTube, TikTok and Telegram services with automated order fulfillment, manual payment approval, support tickets and a full admin dashboard.

## Features

- **Authentication** — email/password + Google OAuth, email verification, password reset
- **User dashboard** — balance, order stats, recent orders, spending
- **Services** — search, filter by category, favorites, featured badges, service detail pages
- **Orders** — place orders, track status in realtime, cancel, refill, retry failed orders
- **Payments** — manual deposits (bKash / Nagad / Rocket) with screenshot upload and admin approval
- **Wallet / transactions** — full deposit & spending ledger with per-user currency
- **Coupons** — percent or fixed discounts with usage limits and expiry
- **Support tickets** — user <-> admin threads with realtime message delivery
- **Notifications** — in-app notifications pushed on payment/order/ticket events
- **Admin panel** — users, orders, services, categories, providers, payments, transactions, support, coupons, announcements, audit logs, API keys, settings
- **Provider integration** — SMMFollow import/sync, order create/status/cancel/refill with cron-based status polling
- **Public API** — SMM API v1 compatible endpoint (`/api/smm/v1`) authenticated by API keys
- **Security** — Row Level Security on every table, server-action guards, rate limiting, audit log

## Tech Stack

- Next.js 15 (App Router, React 19, TypeScript)
- Tailwind CSS + shadcn/ui + Framer Motion
- React Hook Form + Zod validation
- TanStack Query + TanStack Table
- Supabase (Auth, Postgres, Storage, Realtime)
- SMMFollow provider API

## Getting Started

Requirements: Node.js 20+, npm, and a Supabase project (free tier works).

```bash
npm install
```

The postinstall script creates a `.env.local` from `.env.example` if one does not exist. Fill in the values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SMMFOLLOW_API_URL=https://smmfollows.com/api/v2
SMMFOLLOW_API_KEY=your-provider-api-key
```

`SUPABASE_SERVICE_ROLE_KEY` is **required**: the order-status cron and the `/api/smm/v1` public API use it server-side. It must never be exposed to the browser.

Apply the database schema (see [docs/supabase-setup.md](docs/supabase-setup.md)), then run:

```bash
npm run dev
```

Open http://localhost:3000. The first registered user is automatically promoted to admin.

## Scripts

| Command              | Description                              |
| -------------------- | ---------------------------------------- |
| `npm run dev`        | Start the dev server                     |
| `npm run build`      | Production build                         |
| `npm run start`      | Start the production server              |
| `npm run lint`       | Run ESLint                               |
| `npm run typecheck`  | Run TypeScript type checking             |
| `npm run db:push`    | Push migrations to a linked Supabase DB  |
| `npm run db:reset`   | Reset the local Supabase database        |

## Environment Variables

All variables live in `.env.example`. The only ones needed at runtime in the browser are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Everything else (service role key, provider API key, Upstash credentials, cron secret) stays server-side.

## Documentation

- [Supabase setup](docs/supabase-setup.md) — create the project, run migrations, enable auth
- [Vercel deployment](docs/vercel-deploy.md) — deploy, env vars, cron scheduling
- [GitHub guide](docs/github-guide.md) — repository setup and CI/CD

## License

Private project. Do not distribute.
