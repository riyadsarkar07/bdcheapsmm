import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { providerApi, normalizeProviderStatus } from "@/lib/provider/smmfollow";
import type { OrderStatus } from "@/lib/types/database";

/**
 * Vercel Cron job - polls providers for order status updates.
 * Configure in vercel.json:
 *   "crons": [{ "path": "/api/cron/order-status", "schedule": "once per day" }]
 *
 * Vercel Hobby plan cron jobs are limited to a once-per-day schedule.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, provider_id, provider_order_id, status")
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

      if (["completed", "partial", "cancelled", "refunded", "failed"].includes(status)) {
        await supabase.from("orders").update({
          status,
          start_count: result.start_count ?? null,
          remain: result.remain ?? null,
          provider_response: result as never,
        }).eq("id", order.id);
        updated++;
      } else if (status !== order.status) {
        await supabase.from("orders").update({
          status,
          start_count: result.start_count ?? null,
          remain: result.remain ?? null,
        }).eq("id", order.id);
        updated++;
      }
    } catch {
      // Skip transient provider errors
    }
  }

  return NextResponse.json({ ok: true, checked: orders.length, updated });
}
