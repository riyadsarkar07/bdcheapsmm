import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runProviderHealthChecks } from "@/lib/provider-health";

/**
 * Provider health polling endpoint - runs a real API probe (balance lookup)
 * against every configured, active provider and records availability, latency,
 * last success/failure and error counters. Invoked by:
 *  - GitHub Actions workflow .github/workflows/provider-health-poll.yml (every 10 minutes)
 *  - Vercel Cron (vercel.json) as a daily fallback
 *
 * Auth: same contract as /api/cron/order-status (Bearer <CRON_SECRET> or a
 * Vercel cron user-agent). Health checks never touch order data.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const userAgent = request.headers.get("user-agent") ?? "";
  const isVercelCron =
    userAgent.startsWith("vercel-cron/") || request.headers.get("x-vercel-cron-schedule") !== null;
  if (process.env.CRON_SECRET && !isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: providers, error } = await supabase
    .from("providers")
    .select("id, name, api_url, api_key, status, priority");

  if (error || !providers) {
    return NextResponse.json({ ok: false, error: error?.message ?? "No providers" }, { status: 500 });
  }

  const tally = await runProviderHealthChecks(supabase, providers);

  return NextResponse.json({ ok: true, ...tally });
}
