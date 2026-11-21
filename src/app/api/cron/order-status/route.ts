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
  let failed = 0;

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

      if (status === "refunded" || status === "cancelled") {
        const refund = await supabase.rpc("refund_order", { p_order_id: order.id, p_refunded_by: null });
        if (refund.error) throw refund.error;
        updated++;
      } else if (isTerminal || statusChanged || countsChanged) {
        const write = await supabase.from("orders").update({
          status,
          start_count: counts.start_count,
          remain: counts.remain,
          ...(isTerminal ? { provider_response: result as never } : {}),
        }).eq("id", order.id).eq("status", order.status).select("id").maybeSingle();
        if (write.error) throw write.error;
        if (write.data) updated++;
      }
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ ok: failed === 0, checked: orders.length, updated, failed }, { status: failed ? 502 : 200 });
}
