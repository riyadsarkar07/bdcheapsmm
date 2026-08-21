import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeOrderCharge } from "@/lib/pricing";
import { createHash } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function isActiveApiKey(apiKey: { is_active: boolean; expires_at: string | null }): boolean {
  if (!apiKey.is_active) return false;
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) return false;
  return true;
}

export async function POST(request: Request) {
  const apiKeyHeader = request.headers.get("x-api-key");
  if (!apiKeyHeader) {
    return NextResponse.json({ error: "Missing x-api-key header" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: apiKey } = await supabase
    .from("api_keys")
    .select("id, user_id, key_hash, is_active, expires_at, permissions")
    .eq("key_hash", hashKey(apiKeyHeader))
    .maybeSingle();

  if (!apiKey || !isActiveApiKey(apiKey)) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", apiKey.id);

  const permissions = (apiKey.permissions as string[]) ?? [];
  if (!permissions.includes("orders:create")) {
    return NextResponse.json({ error: "API key lacks orders:create permission" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { service: providerServiceId, link, quantity, coupon } = body;
  if (!providerServiceId || !link || !quantity) {
    return NextResponse.json({ error: "service, link and quantity are required" }, { status: 400 });
  }

  const { data: service } = await supabase
    .from("services")
    .select("id, name, provider_id, provider_service_id, price, min_quantity, max_quantity, is_active")
    .eq("provider_service_id", String(providerServiceId))
    .eq("is_active", true)
    .maybeSingle();

  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }
  if (!service.provider_id) {
    return NextResponse.json({ error: "Service has no provider" }, { status: 500 });
  }

  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < service.min_quantity || qty > service.max_quantity) {
    return NextResponse.json(
      { error: `Quantity must be between ${service.min_quantity} and ${service.max_quantity}` },
      { status: 400 }
    );
  }

  if (!apiKey.user_id) {
    return NextResponse.json({ error: "API key has no linked account" }, { status: 500 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, balance, currency, status")
    .eq("id", apiKey.user_id)
    .single();

  if (!profile) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  if (profile.status !== "active") return NextResponse.json({ error: "Account suspended" }, { status: 403 });

  const { data: provider } = await supabase
    .from("providers")
    .select("id, name, api_url, api_key")
    .eq("id", service.provider_id)
    .single();
  if (!provider) return NextResponse.json({ error: "Provider not configured" }, { status: 500 });

  const price = computeOrderCharge(service.price, qty);
  if (profile.balance < price) {
    return NextResponse.json(
      { error: `Insufficient balance: need ${price}, have ${profile.balance}` },
      { status: 402 }
    );
  }

  const orderNumber = `SMM${new Date().getFullYear().toString().slice(2)}${Math.floor(100000 + Math.random() * 900000)}`;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      user_id: profile.id,
      service_id: service.id,
      provider_id: service.provider_id,
      link: String(link),
      quantity: qty,
      price,
      status: "pending",
      currency: profile.currency,
    })
    .select("*")
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }

  const { data: charged, error: chargeError } = await supabase.rpc("deduct_order_cost", {
    p_order_id: order.id,
    p_user_id: profile.id,
  });
  if (chargeError || !charged) {
    await supabase.from("orders").update({ status: "rejected", error_message: "Balance check failed" }).eq("id", order.id);
    return NextResponse.json({ error: "Insufficient balance" }, { status: 402 });
  }

  try {
    const { providerApi } = await import("@/lib/provider/smmfollow");
    const result = await providerApi.createOrder(provider, {
      service: Number(service.provider_service_id),
      link: String(link),
      quantity: qty,
    });
    await supabase.from("orders").update({
      status: "processing",
      provider_order_id: String(result.order),
      provider_response: result as never,
    }).eq("id", order.id);
    return NextResponse.json({
      order: orderNumber,
      id: order.id,
      provider_order_id: String(result.order),
      price,
      status: "processing",
    });
  } catch (err) {
    await supabase.from("orders").update({
      status: "failed",
      error_message: (err as Error).message,
      provider_response: { error: (err as Error).message } as never,
    }).eq("id", order.id);
    return NextResponse.json(
      { error: (err as Error).message, order: orderNumber, id: order.id, status: "failed" },
      { status: 502 }
    );
  }
}
