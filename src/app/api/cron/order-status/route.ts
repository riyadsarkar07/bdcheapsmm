import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  providerApi,
  isKnownOrderStatus,
  mergeProviderCounts,
  normalizeProviderStatus,
} from "@/lib/provider/smmfollow";
import type { OrderStatus } from "@/lib/types/database";

/**
 * Order status polling endpoint - polls providers for order status updates and
 * writes the latest status to the orders table. Invoked by:
 *  - GitHub Actions workflow .github/workflows/order-status-poll.yml (every 10 minutes)
 *  - Vercel Cron (vercel.json) as a daily fallback
 *
 * Auth: accepts `Authorization: Bearer <CRON_SECRET>` (external schedulers) or
 * Vercel's own cron invocations (identified by the `vercel-cron/1.0` user agent,
 * which carry no Authorization header).
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

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, provider_id, provider_order_id, status, start_count, remain")
    .in("status", ["pending", "processing", "in_progress"])
    .not("provider_order_id", "is", null);

  if (error || !orders) {
    return NextResponse.json({ ok: false, error: error?.message ?? "No orders" }, { status: 500 });
  }

  const providerCache = new Map<string, { id: string; name: string; api_url: string; api_key: string }>();
  let updated = 0;

  for (const order of orders) {
    if (!order.provider_id || !order.provider_order_id) continue;

    let provider = providerCache.get(order.provider_id);
    if (!provider) {
      const { data: p } = await supabase
        .from("providers")
        .select("id, name, api_url, api_key")
        .eq("id", order.provider_id)
        .single();
      if (!p) continue;
      provider = p;
      providerCache.set(order.provider_id, p);
    }

    try {
      const result = await providerApi.getStatus(provider, order.provider_order_id);
      const status = normalizeProviderStatus(result.status) as OrderStatus;

      if (!isKnownOrderStatus(status)) {
        // Unmapped provider status - skip to avoid writing an invalid enum value.
        continue;
      }

      // Persist provider counts on every poll. A valid numeric value wins; an
      // empty/missing value keeps the previously saved one so a start count is
      // never wiped while the order is still in flight.
      const counts = mergeProviderCounts(result, {
        start_count: order.start_count ?? null,
        remain: order.remain ?? null,
      });
      const isTerminal = ["completed", "partial", "cancelled", "refunded", "failed"].includes(status);
      const statusChanged = status !== order.status;
      const countsChanged =
        counts.start_count !== (order.start_count ?? null) ||
        counts.remain !== (order.remain ?? null);

      if (isTerminal || statusChanged || countsChanged) {
        await supabase.from("orders").update({
          status,
          start_count: counts.start_count,
          remain: counts.remain,
          ...(isTerminal ? { provider_response: result as never } : {}),
        }).eq("id", order.id);
        updated++;
      }
    } catch {
      // Skip transient provider errors
    }
  }

  return NextResponse.json({ ok: true, checked: orders.length, updated });
}
