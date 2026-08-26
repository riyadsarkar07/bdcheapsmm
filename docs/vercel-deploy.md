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

## 4. Order status polling

Provider order statuses are synced by the `/api/cron/order-status` endpoint, which is triggered by two schedulers:

1. **GitHub Actions** (`.github/workflows/order-status-poll.yml`) — the frequent poller, runs every 10 minutes via a scheduled workflow. It calls the endpoint with `Authorization: Bearer <CRON_SECRET>`.
2. **Vercel Cron** (`vercel.json`) — a daily fallback at `0 0 * * *` UTC. Vercel Hobby plans allow cron jobs at most **once per day**; more frequent expressions such as `*/5 * * * *` fail deployment on Hobby.

Setup requirements:

- **GitHub Actions secret** — add `CRON_SECRET` (the same value as the Vercel env var) as a repository secret, otherwise the poller fails with a clear error.
- **Repository variable** (optional) — set `PROD_BASE_URL` (with protocol, e.g. `https://your-app.vercel.app`) if the production domain differs from the workflow default.
- **Endpoint auth** — the route accepts `Authorization: Bearer <CRON_SECRET>` from external schedulers, and also accepts Vercel's own cron invocations (user agent `vercel-cron/1.0`, which carry no Authorization header). This is required because Vercel cron requests do not include custom headers.

Because the frequent poller runs off-Vercel, status updates stay automatic on any Vercel plan.

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
