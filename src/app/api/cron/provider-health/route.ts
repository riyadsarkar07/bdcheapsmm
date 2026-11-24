import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshRefillCatalog } from "@/lib/provider/refill-sync";
import { runProviderHealthChecks } from "@/lib/provider-health";

/**
 * Provider health polling endpoint - runs a real API probe (balance lookup)
 * against every configured, active provider and records availability, latency,
 * last success/failure and error counters. Invoked by:
 *  - GitHub Actions workflow .github/workflows/provider-health-poll.yml (every 10 minutes)
 *  - Vercel Cron (vercel.json) as a daily fallback
 *
 * Auth: requires the configured scheduler bearer secret.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: providers, error } = await supabase
    .from("providers")
    .select("id, name, api_url, api_key, status, priority");

  if (error || !providers) {
    return NextResponse.json({ ok: false, error: error?.message ?? "No providers" }, { status: 500 });
  }

  const [tally, refill] = await Promise.all([runProviderHealthChecks(supabase, providers), refreshRefillCatalog()]);

  return NextResponse.json({ ok: refill.failed === 0, ...tally, refill }, { status: refill.failed ? 502 : 200 });
}
