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

  const started = Date.now();
  const supabase = createAdminClient();

  await supabase.rpc("deliver_refill_reminders",{});
  const {data:refills}=await supabase.from("orders").select("id,provider_refill_id,provider_id").not("provider_refill_id","is",null)
    .or("refill_poll_after.is.null,refill_poll_after.lte."+new Date().toISOString()).order("refill_poll_after",{nullsFirst:true}).limit(4);
  await Promise.all((refills??[]).map(async r=>{
    if(!r.provider_id||!r.provider_refill_id)return;
    const {data:p}=await supabase.from("providers").select("api_key,api_url,name").eq("id",r.provider_id).maybeSingle();if(!p)return;
    const status=await providerApi.refillStatus(p,r.provider_refill_id).catch(()=>null);
    const final=status&&["completed","rejected","cancelled","canceled","failed"].includes(status.toLowerCase());
    await supabase.from("orders").update({...(status?{provider_refill_status:status}:{}),refill_checked_at:new Date().toISOString(),refill_poll_after:final?"9999-12-31T00:00:00Z":new Date(Date.now()+(status?1:24)*3600000).toISOString()}).eq("id",r.id).eq("provider_refill_id",r.provider_refill_id);
  }));
  const providerCache = new Map<string, { id: string; name: string; api_url: string; api_key: string }>();
  let updated = 0;
  let failed = 0;

  let checked=0;
  type PendingOrder={id:string;provider_id:string|null;provider_order_id:string|null;status:OrderStatus;start_count:number|null;remain:number|null};
  async function poll(order:PendingOrder) {
    if (!order.provider_id || !order.provider_order_id) return;

    let provider = providerCache.get(order.provider_id);
    if (!provider) {
      const { data: p } = await supabase
        .from("providers")
        .select("id, name, api_url, api_key")
        .eq("id", order.provider_id)
        .single();
      if (!p) return;
      provider = p;
      providerCache.set(order.provider_id, p);
    }

    try {
      const result = await providerApi.getStatus(provider, order.provider_order_id);
      const mapped = normalizeProviderStatus(result.status);
      const status = isKnownOrderStatus(mapped) ? mapped as OrderStatus : order.status;
      // Persist provider counts on every poll. A valid numeric value wins; an
      // empty/missing value keeps the previously saved one so a start count is
      // never wiped while the order is still in flight.
      const counts = mergeProviderCounts(result, {
        start_count: order.start_count ?? null,
        remain: order.remain ?? null,
      });
      const response = { ...result, panel_checked_at: new Date().toISOString() };

      if (status === "refunded" || status === "cancelled") {
        const snapshot = await supabase.from("orders").update({
          provider_response: response as never, ...counts,
        }).eq("id", order.id).eq("provider_order_id", order.provider_order_id).eq("status", order.status).select("id").maybeSingle();
        if (snapshot.error) throw snapshot.error;
        if (!snapshot.data) return;
        const refund = await supabase.rpc("refund_order", { p_order_id: order.id, p_refunded_by: null });
        if (refund.error) throw refund.error;
        updated++;
      } else {
        const write = await supabase.from("orders").update({
          status,
          start_count: counts.start_count,
          remain: counts.remain,
          provider_response: response as never,
        }).eq("id", order.id).eq("provider_order_id", order.provider_order_id).eq("status", order.status).select("id").maybeSingle();
        if (write.error) throw write.error;
        if (write.data) updated++;
      }
    } catch {
      failed++;
    }
  }

  while (checked < 24 && Date.now()-started < 30000) {
    const batch=await supabase.rpc("claim_order_checks",{});
    if(batch.error)return NextResponse.json({ok:false,checked,updated,failed},{status:500});
    if(!batch.data?.length)break;
    checked+=batch.data.length;
    await Promise.all(batch.data.map(poll));
  }
  return NextResponse.json({ ok: failed === 0, checked, updated, failed }, { status: failed ? 502 : 200 });
}
