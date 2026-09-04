"use server";

import { headers } from "next/headers";
import { createHash, randomBytes } from "crypto";
import {
  adminCategorySchema,
  adminCouponSchema,
  adminProviderSchema,
  adminServiceSchema,
  adminSettingsSchema,
  adminUserSchema,
  apiKeyCreateSchema,
  balanceAdjustSchema,
} from "@/lib/validations";
import { fail, ok, requireAdmin, type ActionResult } from "@/lib/guards";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { providerApi, parseServiceType } from "@/lib/provider/smmfollow";
import { probeProvider, recordProviderHealth, deriveHealth } from "@/lib/provider-health";
import { slugify, formatUsd } from "@/lib/utils";
import { writeLog } from "@/lib/audit";
import { createNotification, notifyAllAdmins } from "@/lib/notify";
import { setSetting } from "@/lib/settings";
import type { OrderStatus } from "@/lib/types/database";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function computeRetailPrice(providerPrice: number, marginPercent: number): number {
  return round2(providerPrice * (1 + marginPercent / 100));
}

// ============================================================
// Categories
// ============================================================

export async function createCategoryAction(input: unknown): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  const parsed = adminCategorySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid category");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error: insertError } = await supabase
    .from("categories")
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description || null,
      icon: parsed.data.icon || null,
      sort_order: parsed.data.sortOrder,
      is_active: parsed.data.isActive,
    })
    .select("id")
    .single();
  if (insertError) return fail(insertError.message);

  await writeLog({ userId: user.id, action: "create", entityType: "categories", entityId: data.id, description: `Created category ${parsed.data.name}` });
  return ok(undefined, "Category created.");
}

export async function updateCategoryAction(id: string, input: unknown): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  const parsed = adminCategorySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid category");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error: updateError } = await supabase.from("categories").update({
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description || null,
    icon: parsed.data.icon || null,
    sort_order: parsed.data.sortOrder,
    is_active: parsed.data.isActive,
  }).eq("id", id);
  if (updateError) return fail(updateError.message);

  await writeLog({ userId: user.id, action: "update", entityType: "categories", entityId: id, description: `Updated category ${parsed.data.name}` });
  return ok(undefined, "Category updated.");
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await supabase.from("services").update({ category_id: null }).eq("category_id", id);
  const { error: delError } = await supabase.from("categories").delete().eq("id", id);
  if (delError) return fail(delError.message);
  await writeLog({ userId: user.id, action: "delete", entityType: "categories", entityId: id, description: "Deleted category" });
  return ok(undefined, "Category deleted.");
}

// ============================================================
// Services
// ============================================================

export async function createServiceAction(input: unknown): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  const parsed = adminServiceSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid service");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error: insertError } = await supabase
    .from("services")
    .insert({
      category_id: parsed.data.categoryId || null,
      provider_id: parsed.data.providerId || null,
      provider_service_id: parsed.data.providerServiceId || null,
      name: parsed.data.name,
      slug: slugify(parsed.data.name) + "-" + Date.now().toString().slice(-6),
      description: parsed.data.description || null,
      price: parsed.data.price,
      min_quantity: parsed.data.minQuantity,
      max_quantity: parsed.data.maxQuantity,
      average_time: parsed.data.averageTime || null,
      type: parsed.data.type || null,
      profit_margin: parsed.data.profitMargin,
      pricing_mode: parsed.data.pricingMode,
      is_active: parsed.data.isActive,
      is_featured: parsed.data.isFeatured,
    })
    .select("id")
    .single();
  if (insertError) return fail(insertError.message);

  await writeLog({ userId: user.id, action: "create", entityType: "services", entityId: data.id, description: `Created service ${parsed.data.name}` });
  return ok(undefined, "Service created.");
}

export async function updateServiceAction(id: string, input: unknown): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  const parsed = adminServiceSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid service");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error: updateError } = await supabase.from("services").update({
    category_id: parsed.data.categoryId || null,
    provider_id: parsed.data.providerId || null,
    provider_service_id: parsed.data.providerServiceId || null,
    name: parsed.data.name,
    description: parsed.data.description || null,
    price: parsed.data.price,
    min_quantity: parsed.data.minQuantity,
    max_quantity: parsed.data.maxQuantity,
    average_time: parsed.data.averageTime || null,
    type: parsed.data.type || null,
    profit_margin: parsed.data.profitMargin,
    pricing_mode: parsed.data.pricingMode,
    is_active: parsed.data.isActive,
    is_featured: parsed.data.isFeatured,
  }).eq("id", id);
  if (updateError) return fail(updateError.message);

  await writeLog({ userId: user.id, action: "update", entityType: "services", entityId: id, description: `Updated service ${parsed.data.name}` });
  return ok(undefined, "Service updated.");
}

export async function deleteServiceAction(id: string): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error: delError } = await supabase.from("services").delete().eq("id", id);
  if (delError) return fail(delError.message);
  await writeLog({ userId: user.id, action: "delete", entityType: "services", entityId: id, description: "Deleted service" });
  return ok(undefined, "Service deleted.");
}

export async function toggleServicesAction(ids: string[], isActive: boolean): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error: updateError } = await supabase.from("services").update({ is_active: isActive }).in("id", ids);
  if (updateError) return fail(updateError.message);
  await writeLog({ userId: user.id, action: "update", entityType: "services", entityId: ids.join(","), description: `${isActive ? "Enabled" : "Disabled"} ${ids.length} services` });
  return ok(undefined, `${ids.length} service(s) updated.`);
}

export async function bulkDeleteServicesAction(ids: string[]): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error: delError } = await supabase.from("services").delete().in("id", ids);
  if (delError) return fail(delError.message);
  await writeLog({ userId: user.id, action: "delete", entityType: "services", entityId: ids.join(","), description: `Deleted ${ids.length} services` });
  return ok(undefined, `${ids.length} service(s) deleted.`);
}

export async function bulkPriceUpdateAction(input: {
  ids: string[];
  mode: "percentage" | "margin";
  value: number;
}): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  if (input.ids.length === 0) return fail("No services selected.");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: services } = await supabase
    .from("services")
    .select("id, provider_price, price, profit_margin, pricing_mode")
    .in("id", input.ids);

  if (!services) return fail("Failed to load services.");

  let changed = 0;
  for (const service of services) {
    if (input.mode === "percentage") {
      // Manual markup: always applies and switches the service to custom pricing.
      const newPrice = Math.max(round2(service.price * (1 + input.value / 100)), 0);
      await supabase.from("services").update({ price: newPrice, pricing_mode: "custom" }).eq("id", service.id);
      changed++;
    } else if (input.mode === "margin") {
      // Margin mode only applies to global-markup services; custom prices stay untouched.
      if (service.pricing_mode === "custom") continue;
      if (service.provider_price == null) continue;
      const newPrice = computeRetailPrice(service.provider_price, input.value);
      await supabase.from("services").update({ price: newPrice, profit_margin: input.value }).eq("id", service.id);
      changed++;
    }
  }

  await writeLog({
    userId: user.id,
    action: "update",
    entityType: "services",
    entityId: input.ids.join(","),
    description: `Bulk price update (${input.mode} ${input.value}%) on ${changed} services`,
  });
  return ok(undefined, `Updated ${changed} services.`);
}

export async function previewGlobalProfitAction(input: { profitPercentage: number; rounding: "round2" | "round" | "ceil" }): Promise<
  ActionResult<{ total: number; preview: { id: string; name: string; price: number; newPrice: number; providerPrice: number }[] }>
> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: services, count } = await supabase
    .from("services")
    .select("id, name, price, provider_price", { count: "exact", head: false })
    .eq("pricing_mode", "global")
    .not("provider_price", "is", null)
    .order("name", { ascending: true })
    .limit(50);

  if (!services) return fail("Failed to load services.");

  const preview = services.map((s) => {
    const newPrice = applyRounding(computeRetailPrice(s.provider_price!, input.profitPercentage), input.rounding);
    return { id: s.id, name: s.name, price: s.price, newPrice, providerPrice: s.provider_price! };
  });

  return ok({ total: count ?? 0, preview });
}

export async function applyGlobalProfitAction(input: { profitPercentage: number; rounding: "round2" | "round" | "ceil" }): Promise<
  ActionResult<{ updated: number }>
> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // The whole update runs inside a single `apply_global_profit` RPC so it
  // completes in one database round-trip instead of one UPDATE per service
  // (which exceeded the serverless function duration and left the UI stuck on
  // "loading").
  const { data, error: rpcError } = await supabase.rpc("apply_global_profit", {
    p_percentage: input.profitPercentage,
    p_rounding: input.rounding,
  });
  if (rpcError) return fail(`Failed to apply pricing: ${rpcError.message}`);

  const updated = typeof data === "number" ? data : Number(data ?? 0);

  await setSetting("pricing", {
    global_profit_percentage: input.profitPercentage,
    rounding: input.rounding,
  });

  await writeLog({
    userId: user.id,
    action: "update",
    entityType: "services",
    description: `Applied global profit ${input.profitPercentage}% (${input.rounding}) to ${updated} global-markup services`,
  });
  return ok({ updated }, `Applied global profit to ${updated} services.`);
}

function applyRounding(value: number, rounding: "round2" | "round" | "ceil"): number {
  if (rounding === "round") return Math.round(value);
  if (rounding === "ceil") return Math.ceil(value);
  return round2(value);
}

// ============================================================
// Providers
// ============================================================

export async function createProviderAction(input: unknown): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  const parsed = adminProviderSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid provider");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error: insertError } = await supabase
    .from("providers")
    .insert({
      name: parsed.data.name,
      api_url: parsed.data.apiUrl,
      api_key: parsed.data.apiKey,
      api_key_encrypted: false,
      status: parsed.data.status,
      priority: parsed.data.priority,
    })
    .select("id")
    .single();
  if (insertError) return fail(insertError.message);

  await writeLog({ userId: user.id, action: "create", entityType: "providers", entityId: data.id, description: `Created provider ${parsed.data.name}` });
  return ok(undefined, "Provider created.");
}

export async function updateProviderAction(id: string, input: unknown): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  const parsed = adminProviderSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid provider");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: existing } = await supabase.from("providers").select("api_key").eq("id", id).single();
  const apiKey = parsed.data.apiKey || existing?.api_key || "";

  const { error: updateError } = await supabase.from("providers").update({
    name: parsed.data.name,
    api_url: parsed.data.apiUrl,
    api_key: apiKey,
    status: parsed.data.status,
    priority: parsed.data.priority,
  }).eq("id", id);
  if (updateError) return fail(updateError.message);

  await writeLog({ userId: user.id, action: "update", entityType: "providers", entityId: id, description: `Updated provider ${parsed.data.name}` });
  return ok(undefined, "Provider updated.");
}

export async function deleteProviderAction(id: string): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await supabase.from("services").update({ provider_id: null, provider_service_id: null }).eq("provider_id", id);
  const { error: delError } = await supabase.from("providers").delete().eq("id", id);
  if (delError) return fail(delError.message);
  await writeLog({ userId: user.id, action: "delete", entityType: "providers", entityId: id, description: "Deleted provider" });
  return ok(undefined, "Provider deleted.");
}

export async function syncProviderServicesAction(providerId: string): Promise<ActionResult<{ imported: number; updated: number }>> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  const limited = await rateLimit(`providersync:${user.id}`, 5, 300);
  if (!limited.success) return fail("Sync in progress. Please wait.");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: provider } = await supabase.from("providers").select("*").eq("id", providerId).single();
  if (!provider) return fail("Provider not found.");

  await supabase.from("providers").update({ sync_status: "syncing", sync_message: "Fetching services..." }).eq("id", providerId);

  try {
    const items = await providerApi.getServices(provider);

    // Build the payload once; the insert/update of every service happens inside
    // the `sync_provider_services` RPC (one DB round-trip) so syncing ~1.7k
    // services finishes well within the serverless function limit.
    const payload = items.map((item) => ({
      service: String(item.service),
      name: item.name,
      category: item.category,
      category_slug: slugify(item.category),
      rate: Number(item.rate),
      min: Number(item.min),
      max: Number(item.max),
      average_time: item.average_time ?? null,
      type: parseServiceType(item.type + " " + item.name),
      description: item.description ?? null,
      refill: item.refill ?? null,
      cancel: item.cancel ?? null,
      driptype: item.driptype ?? null,
    }));

    const { data, error: rpcError } = await supabase.rpc("sync_provider_services", {
      p_provider_id: providerId,
      p_items: payload as never,
    });

    if (rpcError) {
      await supabase.from("providers").update({ sync_status: "error", sync_message: rpcError.message }).eq("id", providerId);
      return fail(`Sync failed: ${rpcError.message}`);
    }

    const first = Array.isArray(data) ? data[0] : data;
    const imported = Number(first?.imported ?? 0);
    const updated = Number(first?.updated ?? 0);

    await supabase
      .from("providers")
      .update({
        balance: null,
        last_sync_at: new Date().toISOString(),
        sync_status: "done",
        sync_message: `${items.length} services found. ${imported} imported, ${updated} updated.`,
      })
      .eq("id", providerId);

    await writeLog({
      userId: user.id,
      action: "provider_sync",
      entityType: "providers",
      entityId: provider.id,
      description: `Synced provider ${provider.name}: ${imported} imported, ${updated} updated`,
      meta: { imported, updated, total: items.length },
    });
    return ok({ imported, updated }, `Synced: ${imported} new, ${updated} updated (${items.length} total).`);
  } catch (err) {
    await supabase.from("providers").update({ sync_status: "error", sync_message: (err as Error).message }).eq("id", providerId);
    return fail((err as Error).message);
  }
}

export async function checkProviderBalanceAction(providerId: string): Promise<ActionResult<{ balance: number }>> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: provider } = await supabase.from("providers").select("*").eq("id", providerId).single();
  if (!provider) return fail("Provider not found.");
  try {
    const result = await providerApi.getBalance(provider);
    await supabase.from("providers").update({ balance: result.balance }).eq("id", providerId);
    await writeLog({ userId: user.id, action: "provider_sync", entityType: "providers", entityId: provider.id, description: `Checked provider balance for ${provider.name}` });
    return ok({ balance: result.balance });
  } catch (err) {
    return fail((err as Error).message);
  }
}

export async function testProviderConnectionAction(providerId: string): Promise<ActionResult<{ ok: boolean; latencyMs: number }>> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: provider } = await supabase.from("providers").select("*").eq("id", providerId).single();
  if (!provider) return fail("Provider not found.");
  try {
    const startedAt = Date.now();
    await providerApi.getBalance(provider);
    const latencyMs = Date.now() - startedAt;
    await writeLog({
      userId: user.id,
      action: "provider_sync",
      entityType: "providers",
      entityId: provider.id,
      description: `Tested provider connection for ${provider.name}`,
    });
    return ok({ ok: true, latencyMs }, `Connection OK (${latencyMs}ms).`);
  } catch (err) {
    return fail(`Connection failed: ${(err as Error).message}`);
  }
}

export async function checkProviderHealthAction(providerId: string): Promise<
  ActionResult<{ status: "healthy" | "slow" | "down"; latencyMs: number }>
> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");

  const limited = await rateLimit(`provider-health:${user.id}`, 10, 60);
  if (!limited.success) return fail("Too many requests. Please wait.");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: provider } = await supabase.from("providers").select("*").eq("id", providerId).single();
  if (!provider) return fail("Provider not found.");
  if (!provider.api_url || !provider.api_key) {
    return fail("Provider API URL/key is not configured.");
  }

  const result = await probeProvider(provider);
  const status = deriveHealth(result);
  await recordProviderHealth(supabase, provider.id, result);

  await writeLog({
    userId: user.id,
    action: "provider_health",
    entityType: "providers",
    entityId: provider.id,
    description: `Health check for ${provider.name}: ${status} (${result.latencyMs}ms)`,
    meta: {
      ok: result.ok,
      status,
      latency_ms: result.latencyMs,
      error: result.error,
    },
  });

  if (!result.ok) {
    return fail(`Provider is down: ${result.error}`);
  }

  return ok(
    { status: status as "healthy" | "slow", latencyMs: result.latencyMs },
    `${status === "healthy" ? "Healthy" : "Slow"} (${result.latencyMs}ms).`
  );
}

// ============================================================
// Coupons
// ============================================================

export async function createCouponAction(input: unknown): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  const parsed = adminCouponSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid coupon");

  if (parsed.data.discountType === "percent" && parsed.data.discountValue > 100) {
    return fail("Percentage discount cannot exceed 100%.");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error: insertError } = await supabase
    .from("coupons")
    .insert({
      code: parsed.data.code,
      discount_type: parsed.data.discountType,
      discount_value: parsed.data.discountValue,
      min_amount: parsed.data.minAmount ?? null,
      max_discount: parsed.data.maxDiscount ?? null,
      usage_limit: parsed.data.usageLimit ?? null,
      per_user_limit: parsed.data.perUserLimit,
      starts_at: parsed.data.startsAt || null,
      expires_at: parsed.data.expiresAt || null,
      is_active: parsed.data.isActive,
    })
    .select("id")
    .single();
  if (insertError) return fail(insertError.message);

  await writeLog({ userId: user.id, action: "create", entityType: "coupons", entityId: data.id, description: `Created coupon ${parsed.data.code}` });
  return ok(undefined, "Coupon created.");
}

export async function updateCouponAction(id: string, input: unknown): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  const parsed = adminCouponSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid coupon");
  if (parsed.data.discountType === "percent" && parsed.data.discountValue > 100) {
    return fail("Percentage discount cannot exceed 100%.");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error: updateError } = await supabase.from("coupons").update({
    code: parsed.data.code,
    discount_type: parsed.data.discountType,
    discount_value: parsed.data.discountValue,
    min_amount: parsed.data.minAmount ?? null,
    max_discount: parsed.data.maxDiscount ?? null,
    usage_limit: parsed.data.usageLimit ?? null,
    per_user_limit: parsed.data.perUserLimit,
    starts_at: parsed.data.startsAt || null,
    expires_at: parsed.data.expiresAt || null,
    is_active: parsed.data.isActive,
  }).eq("id", id);
  if (updateError) return fail(updateError.message);
  await writeLog({ userId: user.id, action: "update", entityType: "coupons", entityId: id, description: `Updated coupon ${parsed.data.code}` });
  return ok(undefined, "Coupon updated.");
}

export async function deleteCouponAction(id: string): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error: delError } = await supabase.from("coupons").delete().eq("id", id);
  if (delError) return fail(delError.message);
  await writeLog({ userId: user.id, action: "delete", entityType: "coupons", entityId: id, description: "Deleted coupon" });
  return ok(undefined, "Coupon deleted.");
}

// ============================================================
// Settings
// ============================================================

export async function updateSettingsAction(input: unknown): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  const parsed = adminSettingsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid settings");

  await setSetting("site", { name: parsed.data.siteName, tagline: parsed.data.tagline, logo: parsed.data.logo, favicon: parsed.data.favicon }, true);
  await setSetting("general", { currency: parsed.data.currency, timezone: parsed.data.timezone, maintenance_mode: parsed.data.maintenanceMode }, true);
  await setSetting("payments", {
    bKash: parsed.data.bKash,
    nagad: parsed.data.nagad,
    rocket: parsed.data.rocket,
    enabled: (["bKash", "nagad", "rocket"] as const).filter((m) =>
      parsed.data[`${m}Enabled`]
    ),
  }, true);
  await setSetting("seo", {
    title: parsed.data.seoTitle,
    description: parsed.data.seoDescription,
    keywords: parsed.data.seoKeywords,
  }, true);
  await setSetting("footer", { text: parsed.data.footerText, links: [] }, true);

  await writeLog({
    userId: user.id,
    action: "settings_update",
    entityType: "settings",
    description: "Updated site settings",
  });

  // Bust the cache
  const { getPublicSettings } = await import("@/lib/settings");
  await getPublicSettings();
  return ok(undefined, "Settings saved.");
}

// ============================================================
// Users (admin)
// ============================================================

export async function updateUserAction(id: string, input: unknown): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  const parsed = adminUserSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid user data");

  if (id === user.id && parsed.data.role !== "admin") {
    return fail("You cannot remove your own admin role.");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error: updateError } = await supabase.from("profiles").update({
    full_name: parsed.data.fullName,
    phone: parsed.data.phone || null,
    country: parsed.data.country || null,
    currency: parsed.data.currency,
    timezone: parsed.data.timezone,
    status: parsed.data.status,
    role: parsed.data.role,
  }).eq("id", id);
  if (updateError) return fail(updateError.message);
  await writeLog({ userId: user.id, action: "update", entityType: "profiles", entityId: id, description: `Updated user ${parsed.data.fullName}` });
  return ok(undefined, "User updated.");
}

export async function setUserStatusAction(id: string, status: "active" | "banned", reason?: string): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  if (id === user.id && status === "banned") {
    return fail("You cannot suspend your own account.");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("id, full_name, email, status, currency")
    .eq("id", id)
    .maybeSingle();
  if (!target) return fail("User not found.");
  if (target.status === status) return fail(`User is already ${status}.`);

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", id);
  if (updateError) return fail(updateError.message);

  const actionLabel = status === "banned" ? "Suspended" : "Reactivated";
  await writeLog({
    userId: user.id,
    action: status === "banned" ? "suspend" : "unsuspend",
    entityType: "profiles",
    entityId: id,
    description: `${actionLabel} user ${target.full_name}${reason ? `: ${reason}` : ""}`,
    meta: { reason: reason ?? null },
  });

  await createNotification({
    userId: id,
    type: "system_announcement",
    title: `Account ${status === "banned" ? "suspended" : "reactivated"}`,
    body:
      status === "banned"
        ? reason
          ? `Your account has been suspended. Reason: ${reason}`
          : "Your account has been suspended."
        : "Your account has been reactivated. You can log in again.",
    link: "/dashboard",
  });

  return ok(undefined, `${actionLabel} ${target.full_name}.`);
}

export async function adjustUserBalanceAction(id: string, input: unknown): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  const parsed = balanceAdjustSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid amount");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const amount = parsed.data.amount;
  const { data, error: adjustError } = await supabase.rpc("adjust_balance", {
    target_user_id: id,
    amount,
    description: parsed.data.description,
    admin_id: user.id,
    tx_type: "adjustment",
  });
  if (adjustError) return fail(adjustError.message);

  await createNotification({
    userId: id,
    type: "system_announcement",
    title: "Balance adjusted",
    body: `${amount > 0 ? "Credited" : "Debited"} ${Math.abs(amount).toLocaleString()} ${user.currency}. ${parsed.data.description}`,
  });

  return ok(undefined, "Balance adjusted.");
}

// ============================================================
// Payments (admin)
// ============================================================

export async function approvePaymentAction(paymentId: string, note?: string): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error: rpcError } = await supabase.rpc("approve_payment", {
    p_id: paymentId,
    admin_id: user.id,
    p_note: note,
  });
  if (rpcError) return fail(rpcError.message);
  return ok(data as never, "Payment approved. Balance updated.");
}

export async function rejectPaymentAction(paymentId: string, reason?: string): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error: rpcError } = await supabase.rpc("reject_payment", {
    p_id: paymentId,
    admin_id: user.id,
    p_reason: reason,
  });
  if (rpcError) return fail(rpcError.message);
  return ok(data as never, "Payment rejected.");
}

// ============================================================
// Announcements
// ============================================================

export async function sendAnnouncementAction(input: { title: string; body?: string; link?: string; toAll?: boolean; userId?: string }): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  if (!input.title.trim()) return fail("Title is required.");

  if (input.toAll) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: profiles } = await supabase.from("profiles").select("id");
    if (profiles && profiles.length > 0) {
      await supabase.from("notifications").insert(
        profiles.map((p) => ({
          user_id: p.id,
          type: "system_announcement",
          title: input.title,
          body: input.body ?? null,
          link: input.link ?? null,
        }))
      );
    }
  } else if (input.userId) {
    await createNotification({
      userId: input.userId,
      type: "system_announcement",
      title: input.title,
      body: input.body,
      link: input.link,
    });
  } else {
    await notifyAllAdmins({
      type: "system_announcement",
      title: input.title,
      body: input.body,
      link: input.link,
    });
  }

  await writeLog({ userId: user.id, action: "create", entityType: "notifications", description: `Sent announcement: ${input.title}` });
  return ok(undefined, "Announcement sent.");
}

// ============================================================
// Admin order actions
// ============================================================

export async function adminUpdateOrderStatusAction(orderId: string, status: string): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const allowed = ["pending", "processing", "in_progress", "completed", "partial", "cancelled", "rejected", "refunded", "failed"];
  if (!allowed.includes(status)) return fail("Invalid status.");

  const { data: order } = await supabase.from("orders").select("user_id, order_number").eq("id", orderId).single();
  if (!order) return fail("Order not found.");

  await supabase.from("orders").update({ status: status as OrderStatus }).eq("id", orderId);
  await writeLog({ userId: user.id, action: "update", entityType: "orders", entityId: orderId, description: `Set order #${order.order_number} to ${status}` });
  return ok(undefined, "Order status updated.");
}

export async function adminRefundOrderAction(orderId: string): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("id, user_id, price, currency, order_number, status").eq("id", orderId).single();
  if (!order) return fail("Order not found.");

  const { error: refundError } = await supabase.rpc("refund_order", {
    p_order_id: orderId,
    p_refunded_by: user.id,
  });
  if (refundError) return fail(refundError.message);

  await createNotification({
    userId: order.user_id,
    type: "order_cancelled",
    title: "Order refunded",
    body: `Order #${order.order_number} was refunded ${formatUsd(order.price)}.`,
    link: `/orders/${order.id}`,
  });
  await writeLog({ userId: user.id, action: "update", entityType: "orders", entityId: orderId, description: `Refunded order #${order.order_number}` });
  return ok(undefined, "Order refunded.");
}

export async function adminBulkRetryFailedOrdersAction(): Promise<ActionResult<{ retried: number }>> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: failedOrders } = await supabase
    .from("orders")
    .select("id, provider_id, link, quantity, order_number, services(provider_service_id)")
    .in("status", ["failed", "rejected"]);

  let retried = 0;
  for (const order of failedOrders ?? []) {
    if (!order.provider_id || !order.services?.provider_service_id) continue;
    const { data: provider } = await supabase.from("providers").select("id, name, api_url, api_key").eq("id", order.provider_id).single();
    if (!provider) continue;
    try {
      const result = await providerApi.createOrder(provider, {
        service: Number(order.services?.provider_service_id),
        link: order.link,
        quantity: order.quantity,
      });
      await supabase.from("orders").update({
        status: "processing",
        provider_order_id: String(result.order),
        error_message: null,
      }).eq("id", order.id);
      retried++;
    } catch {
      // Skip failed retry
    }
  }
  await writeLog({ userId: user.id, action: "order_retry", entityType: "orders", description: `Bulk retried ${retried} failed orders` });
  return ok({ retried }, `Retried ${retried} order(s).`);
}

// ============================================================
// Public API keys (admin)
// ============================================================

const API_KEY_PERMISSIONS = ["orders:create", "orders:read"];

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function createApiKeyAction(input: unknown): Promise<ActionResult<{ key: string }>> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");

  const parsed = apiKeyCreateSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid API key data");

  const invalidPermissions = parsed.data.permissions.filter((p) => !API_KEY_PERMISSIONS.includes(p));
  if (invalidPermissions.length > 0) return fail(`Unknown permission: ${invalidPermissions.join(", ")}`);

  const rawKey = `sk_${randomBytes(24).toString("base64url")}`;
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error: insertError } = await supabase
    .from("api_keys")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      key_prefix: rawKey.slice(0, 12),
      key_hash: hashApiKey(rawKey),
      permissions: parsed.data.permissions,
      expires_at: parsed.data.expiresAt || null,
      is_active: true,
    })
    .select("id")
    .single();
  if (insertError) return fail(insertError.message);

  await writeLog({ userId: user.id, action: "create", entityType: "api_keys", entityId: data.id, description: `Created API key ${parsed.data.name}` });
  return ok({ key: rawKey }, "API key created. Copy it now — it will not be shown again.");
}

export async function deleteApiKeyAction(id: string): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: existing } = await supabase.from("api_keys").select("name").eq("id", id).single();
  const { error: delError } = await supabase.from("api_keys").delete().eq("id", id);
  if (delError) return fail(delError.message);
  await writeLog({ userId: user.id, action: "delete", entityType: "api_keys", entityId: id, description: `Deleted API key ${existing?.name ?? ""}` });
  return ok(undefined, "API key deleted.");
}

export async function toggleApiKeyAction(id: string, isActive: boolean): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return fail(error ?? "Not authenticated");
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error: updateError } = await supabase.from("api_keys").update({ is_active: isActive }).eq("id", id);
  if (updateError) return fail(updateError.message);
  await writeLog({ userId: user.id, action: "update", entityType: "api_keys", entityId: id, description: `${isActive ? "Enabled" : "Disabled"} API key` });
  return ok(undefined, isActive ? "API key enabled." : "API key disabled.");
}
