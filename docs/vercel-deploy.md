# Vercel Deployment

## 1. Prerequisites

- A Supabase project with migrations applied (see [supabase-setup.md](supabase-setup.md)).
- A GitHub repository containing this project (see [github-guide.md](github-guide.md)).

## 2. Import the project

1. Go to https://vercel.com and click **Add New → Project**.
2. Choose the repository, framework preset is **Next.js** (auto-detected).
3. Click **Deploy**.

## 3. Environment variables

In **Project → Settings → Environment Variables**, add all variables from `.env.example`:

| Variable                        | Notes                                                             |
| ------------------------------- | ---------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | From Supabase Project Settings → API                              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From Supabase Project Settings → API                              |
| `SUPABASE_SERVICE_ROLE_KEY`     | **Required.** Used by the cron job and `/api/smm/v1`; server-only, never exposed to the browser |
| `SMMFOLLOW_API_URL`             | Optional. Provider API URL is normally set per-provider in Admin → Providers |
| `SMMFOLLOW_API_KEY`             | Optional. Provider API key is normally set per-provider in Admin → Providers (server-only) |
| `NEXT_PUBLIC_APP_URL`           | Your production URL, e.g. `https://your-app.vercel.app`            |
| `UPSTASH_REDIS_REST_URL`        | Optional; leave empty for in-memory rate limiting                  |
| `UPSTASH_REDIS_REST_TOKEN`      | Optional                                                          |
| `CRON_SECRET`                   | Any long random string; protects `/api/cron/order-status`          |

Apply them to **Production**, **Preview**, and **Development** environments, then redeploy.

## 4. Cron job (order status polling)

The `vercel.json` at the repo root registers a cron that hits `/api/cron/order-status` once per day so provider order statuses stay in sync.

- The route only accepts requests with `Authorization: Bearer <CRON_SECRET>`.
- Vercel **Hobby** plans allow cron jobs at most **once per day** (schedule `0 0 * * *`, UTC); more frequent expressions such as `*/5 * * * *` fail deployment.
- On Hobby, the cron runs at the scheduled hour with ±59 minute timing precision.
- If your app needs status updates more often than once per day, do **not** add another Vercel cron (Hobby is daily-only). Instead, keep the Hobby cron as a daily fallback and trigger `/api/cron/order-status` on demand from the app after order actions, or use an external scheduler such as GitHub Actions / cron-job.org calling the endpoint with the `Authorization` header.

## 5. Auth callback URLs

In Supabase **Authentication → URL Configuration**:

- Site URL: `https://your-app.vercel.app`
- Redirect URLs: add `https://your-app.vercel.app/auth/callback`

If you use Google OAuth, the provider redirect URI must be updated to point at your Supabase project's callback URL (already set during Supabase setup).

## 6. Post-deploy

1. Open the deployed site and register the first account — it becomes the admin automatically.
2. Go to **Admin → Providers**, set the SMMFollow `api_url`/`api_key`, then run **Sync Services**.
3. Configure payment numbers under **Admin → Settings → Payments**.
4. Verify `/api/health` returns `ok`.

## Troubleshooting

- **404s on dynamic routes** — confirm routes are server-rendered (`revalidate = 0`) and you did not enable static export.
- **`allowedHosts`** — `next.config.mjs` already includes `.monkeycode-ai.live` for preview environments; remove it in production if unwanted.
- **Cron unauthorized** — make sure `CRON_SECRET` matches the `Authorization` header of your scheduled job.
