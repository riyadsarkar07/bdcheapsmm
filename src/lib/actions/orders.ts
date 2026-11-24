"use server";

import { headers } from "next/headers";
import { createOrderSchema, retryOrderSchema } from "@/lib/validations";
import { fail, ok, requireUser, isAdminProfile, type ActionResult } from "@/lib/guards";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { generateOrderNumber, formatCurrency } from "@/lib/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { providerApi, ProviderCancelRejected } from "@/lib/provider/smmfollow";
import { parseChargeError } from "@/lib/pricing";
import { assertOrderPricingSafety } from "@/lib/pricing-safety";
import { writeLog } from "@/lib/audit";
import { createNotification } from "@/lib/notify";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, Order, OrderStatus, Profile } from "@/lib/types/database";

/**
 * Update an order and VERIFY the row was actually changed. supabase-js returns
 * `{ data: null, error: null }` when PostgREST reports success but 0 rows were
 * matched (e.g. RLS filtered the row), so an update without a `select()` can
 * silently no-op and the caller would think the write succeeded. This helper
 * returns `ok:false` whenever the row was not updated, so the caller can fall
 * back to a service-role client.
 */
async function updateOrderVerified(
  client: SupabaseClient<Database>,
  orderId: string,
  updates: Partial<Order>
): Promise<{ ok: boolean; error: { message: string } | null }> {
  try {
    const res = await client
      .from("orders")
      .update(updates)
      .eq("id", orderId)
      .neq("status", "refunded")
      .select("id")
      .maybeSingle();
    if (res.error) return { ok: false, error: res.error };
    if (!res.data) return { ok: false, error: { message: "Order update did not affect any row." } };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: { message: (err as Error).message } };
  }
}

export async function createOrderAction(input: {
  serviceId: string;
  quantity: number;
  link: string;
  coupon?: string;
  expectedUsd?: number;
}): Promise<ActionResult<{ orderId: string; orderNumber: string }>> {
  const headerStore = await headers();
  const ip = getClientIp(headerStore);

  const { user, error } = await requireUser();
  if (error || !user) return fail(error ?? "Not authenticated");
  if (!user) return fail("Not authenticated");

  const limited = await rateLimit(`order:${user.id}`, 20, 60);
  if (!limited.success) {
    return fail("You are creating orders too quickly. Please wait a moment.");
  }

  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.errors[0]?.message ?? "Invalid order data");
  }

  return placeOrder({
    user,
    serviceId: parsed.data.serviceId,
    quantity: parsed.data.quantity,
    link: parsed.data.link,
    coupon: parsed.data.coupon,
    expectedUsd: input.expectedUsd,
    ip,
    userAgent: headerStore.get("user-agent"),
  });
}

/**
 * Shared order-creation path used by both the checkout form and the Retry
 * Order action. The input is already validated and the user is authenticated.
 * It loads the service, verifies active state/provider/qty/balance, then
 * charges the wallet and inserts the order in one DB transaction via
 * create_and_charge_order. The provider is called only after a successful
 * charge. Retries reuse this path so a retried order is created exactly like
 * a fresh one: a new order_number, a new provider order id, and the original
 * (failed) order row is never modified.
 */
async function placeOrder({
  user,
  serviceId,
  quantity,
  link,
  coupon,
  expectedUsd,
  ip,
  userAgent,
}: {
  user: Profile;
  serviceId: string;
  quantity: number;
  link: string;
  coupon?: string;
  expectedUsd?: number;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<ActionResult<{ orderId: string; orderNumber: string }>> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id, name, category_id, provider_id, provider_service_id, price, provider_price, min_quantity, max_quantity, type, is_active")
    .eq("id", serviceId)
    .maybeSingle();

  if (serviceError || !service) {
    return fail("Service not found.");
  }
  if (!service.is_active) {
    return fail("This service is currently disabled.");
  }
  if (!service.provider_id || !service.provider_service_id) {
    return fail("This service has no provider attached.");
  }

  const qty = quantity;
  if (qty < service.min_quantity || qty > service.max_quantity) {
    return fail(
      `Quantity must be between ${service.min_quantity} and ${service.max_quantity} for this service.`
    );
  }

  const admin = createAdminClient();
  const quote = await admin.rpc("order_quote_usd", {
    p_user_id: user.id, p_service_id: service.id, p_quantity: qty, p_coupon: coupon?.trim() || "",
  });
  if (quote.error || quote.data == null) return fail(quote.error?.message ?? "Unable to quote order.");
  const price = quote.data;
  if (expectedUsd !== undefined && expectedUsd !== price) return fail("Price changed. Review your order again.");

  let providerRecord: { id: string; name: string; api_url: string; api_key: string; status: string } | null = null;
  try {
    const admin = createAdminClient();
    const { data: provider } = await admin
      .from("providers")
      .select("id, name, api_url, api_key, status")
      .eq("id", service.provider_id)
      .maybeSingle();
    providerRecord = provider;
  } catch {
    providerRecord = null;
  }

  const pricingCheck = await assertOrderPricingSafety({
    provider: providerRecord,
    providerServiceId: service.provider_service_id,
    storedProviderPrice: service.provider_price,
    quantity: qty,
    sellingPrice: price,
  });
  if (!pricingCheck.ok) {
    return fail(pricingCheck.message);
  }
  const providerCost = pricingCheck.providerCost;

  const orderNumber = generateOrderNumber();

  // Charge the wallet and insert the order in one DB transaction. If the
  // locked profile cannot cover `price`, no order row is created.
  const { data: order, error: orderError } = await admin.rpc("create_and_charge_order", {
    p_user_id: user.id,
    p_order_number: orderNumber,
    p_service_id: service.id,
    p_provider_id: service.provider_id,
    p_link: link,
    p_quantity: qty,
    p_price: price,
    p_coupon: coupon?.trim() || "",
    p_cost: providerCost,
  });

  if (orderError || !order) {
    const parsed = parseChargeError(orderError?.message);
    if (parsed.insufficient) {
      return fail(
        `Insufficient balance. Required: ${formatCurrency(parsed.required, user.currency)}.`
      );
    }
    return fail(orderError?.message ?? "Failed to create order. Please try again.");
  }

  // 3. Submit to provider only after the pricing safety check passed and the
  // wallet charge succeeded. Credentials are already loaded above.
  let providerOrderId: string | null = null;
  let providerResponse: unknown = null;
  let providerName: string | null = null;
  let status: OrderStatus = "processing";

  try {
    if (!providerRecord) {
      status = "failed";
      providerResponse = { error: "Provider missing" };
    } else if (providerRecord.status !== "active") {
      status = "failed";
      providerResponse = { error: `Provider "${providerRecord.name}" is not active.` };
    } else {
      const result = await providerApi.createOrder(providerRecord, {
        service: Number(service.provider_service_id),
        link,
        quantity: qty,
      });
      providerOrderId = String(result.order);
      providerName = providerRecord.name;
      providerResponse = {
        provider_id: providerRecord.id,
        provider_name: providerRecord.name,
        provider_order_id: providerOrderId,
        ...result,
      };
    }
  } catch (err) {
    status = "failed";
    providerResponse = { error: (err as Error).message };
  }

  // Persist provider acceptance and status together. Retry transient database failures once.
  const updates = {
    provider_order_id: providerOrderId,
    provider_id: service.provider_id,
    provider_response: providerResponse as never,
    status,
    charge: providerCost,
    error_message: status === "failed" ? String((providerResponse as { error?: string })?.error ?? "Unknown error") : null,
  };
  let updateError: { message: string } | null = null;
  const firstWrite = await updateOrderVerified(admin, order.id, updates);
  if (!firstWrite.ok) {
    const firstError = firstWrite.error?.message ?? "Order update failed.";
    updateError = { message: firstError };
    try {
      const retryWrite = await updateOrderVerified(createAdminClient(), order.id, updates);
      if (retryWrite.ok) updateError = null;
    } catch (err) {
      updateError = { message: `${firstError} (service-role retry failed: ${(err as Error).message})` };
    }
  }

  if (status === "failed") {
    await createNotification({
      userId: user.id,
      type: "order_status",
      title: "Order submission failed",
      body: `Order #${orderNumber} could not be submitted to provider: ${String((providerResponse as { error?: string })?.error ?? "Unknown error")}. Contact support for a refund.`,
      link: `/orders/${order.id}`,
    });
  } else if (updateError) {
    await writeLog({
      userId: user.id,
      action: "order_create",
      entityType: "orders",
      entityId: order.id,
      description: `Provider accepted order #${orderNumber} (id ${providerOrderId}) but saving the provider reference failed: ${updateError.message}`,
      meta: { price, provider_order_id: providerOrderId, provider_submitted: true, save_error: updateError.message },
    });
  }

  await writeLog({
    userId: user.id,
    action: "order_create",
    entityType: "orders",
    entityId: order.id,
    description: status === "failed"
      ? `Created order #${orderNumber} for ${qty}x ${service.name} but provider submission failed: ${String((providerResponse as { error?: string })?.error ?? "Unknown error")}`
      : `Created order #${orderNumber} for ${qty}x ${service.name} and submitted to provider (provider order id ${providerOrderId})`,
    ip,
    userAgent,
    meta: {
      price,
      provider_cost: providerCost,
      provider_order_id: providerOrderId,
      provider_name: providerName,
      provider_submitted: status !== "failed",
      provider_response: providerResponse as Json,
      save_error: updateError?.message ?? null,
    },
  });

  // If the provider accepted the order but every DB write failed, surface a
  // clear warning so the order is never silently left in "pending" with no
  // provider reference. The log entry above records the full failure.
  return ok(
    { orderId: order.id, orderNumber },
    updateError
      ? `Order #${orderNumber} was submitted to the provider but the status could not be saved yet: ${updateError.message}`
      : undefined
  );
}

export async function quoteCouponAction(serviceId: string, quantity: number, coupon: string): Promise<ActionResult<number>> {
  const { user } = await requireUser();
  if (!user) return fail("Sign in to apply a coupon.");
  const { data, error } = await createAdminClient().rpc("order_quote_usd", {
    p_user_id: user.id, p_service_id: serviceId, p_quantity: quantity, p_coupon: coupon,
  });
  return error || data == null ? fail(error?.message ?? "Coupon unavailable.") : ok(data);
}

export async function cancelOrderAction(orderId: string): Promise<ActionResult> {
  const { user, error } = await requireUser();
  if (error || !user) return fail(error ?? "Not authenticated");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, order_number, user_id, status, provider_id, provider_order_id, price, currency")
    .eq("id", orderId)
    .single();

  if (orderError || !order) return fail("Order not found.");
  if (order.user_id !== user.id && !isAdminProfile(user)) return fail("Forbidden.");
  if (!["pending", "processing", "in_progress"].includes(order.status)) {
    return fail("This order cannot be cancelled.");
  }
  if (!order.provider_order_id || !order.provider_id) return fail("Provider submission is pending. Please check again shortly.");
  const admin = createAdminClient();
  const { data: provider } = await admin.from("providers")
    .select("id, name, api_url, api_key").eq("id", order.provider_id).single();
  if (!provider?.api_key || !provider.api_url) return fail("Provider is not configured.");
  // Claim the request before contacting the provider, including across admin and customer sessions.
  const claim = await admin.from("orders").update({ cancel_count: 1 })
    .eq("id", orderId).eq("provider_id", provider.id).eq("provider_order_id", order.provider_order_id)
    .in("status", ["pending", "processing", "in_progress"])
    .or("cancel_count.is.null,cancel_count.eq.0").select("id").maybeSingle();
  if (claim.error) return fail("Could not record the request. Try again shortly.");
  if (!claim.data) return fail("A request is already recorded or the order status changed. Refresh the order.");
  try {
    await providerApi.cancel(provider, order.provider_order_id);
  } catch (err) {
    if (err instanceof ProviderCancelRejected) {
      const released = await admin.from("orders").update({ cancel_count: 0 })
        .eq("id", orderId).eq("provider_order_id", order.provider_order_id).eq("cancel_count", 1);
      if (released.error) return fail("Provider declined the request. Check the provider order before retrying.");
      return fail(err.message);
    }
    return fail("Provider receipt is unknown. Check the provider order before sending another request.");
  }
  await writeLog({ userId: user.id, action: "order_cancel", entityType: "orders", entityId: orderId,
    description: `Provider ${provider.name} acknowledged cancellation request for #${order.order_number}.` });
  return ok(undefined, `Request accepted by ${provider.name}. Awaiting final provider status.`);
}

export async function refreshOrderStatusAction(
  orderId: string
): Promise<ActionResult<{ status: OrderStatus; start_count: number | null; remain: number | null }>> {
  const { user, error } = await requireUser();
  if (error || !user) return fail(error ?? "Not authenticated");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, user_id, status, provider_id, provider_order_id, order_number, start_count, remain")
    .eq("id", orderId)
    .single();

  if (!order) return fail("Order not found.");
  if (order.user_id !== user.id && !isAdminProfile(user)) return fail("Forbidden.");
  if (!order.provider_order_id) return fail("Order has no provider reference yet.");
  if (!order.provider_id) return fail("Provider not found.");

  const { data: provider } = await createAdminClient()
    .from("providers")
    .select("id, name, api_url, api_key")
    .eq("id", order.provider_id)
    .single();

  if (!provider) return fail("Provider not found.");

  try {
    const result = await providerApi.getStatus(provider, order.provider_order_id);
    const { normalizeProviderStatus, isKnownOrderStatus, mergeProviderCounts } = await import(
      "@/lib/provider/smmfollow"
    );
    const status = normalizeProviderStatus(result.status) as OrderStatus;
    if (!isKnownOrderStatus(status)) {
      return fail(`Provider returned an unrecognized status for this order: "${result.status}".`);
    }
    const counts = mergeProviderCounts(result, {
      start_count: order.start_count ?? null,
      remain: order.remain ?? null,
    });
    const updates = {
      status,
      start_count: counts.start_count,
      remain: counts.remain,
      provider_response: result as never,
    };
    const admin = createAdminClient();
    if (status === "cancelled" || status === "refunded") {
      const snapshot = await admin.from("orders").update({ provider_response: result as never, ...counts }).eq("id", orderId);
      if (snapshot.error) return fail("Unable to save provider confirmation. Please refresh again.");
      const refund = await admin.rpc("refund_order", { p_order_id: orderId, p_refunded_by: user.id });
      if (refund.error) return fail(refund.error.message);
      return ok({ status: "refunded", ...counts });
    }
    const write = await admin.from("orders").update(updates).eq("id", orderId)
      .eq("status", order.status).neq("status", "refunded").select("id").maybeSingle();
    if (write.error || !write.data) return fail("Order changed. Refresh to see its latest status.");
    return ok({ status, start_count: counts.start_count, remain: counts.remain });
  } catch (err) {
    return fail((err as Error).message);
  }
}

export async function refillOrderAction(orderId: string): Promise<ActionResult> {
  const { user, error } = await requireUser();
  if (error || !user) return fail(error ?? "Not authenticated");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, user_id, provider_id, provider_order_id, order_number, refill_count")
    .eq("id", orderId)
    .single();

  if (!order) return fail("Order not found.");
  if (order.user_id !== user.id && !isAdminProfile(user)) return fail("Forbidden.");
  if (!order.provider_order_id) return fail("No provider order reference.");
  if ((order.refill_count ?? 0) >= 2) return fail("Refill limit reached for this order.");
  if (!order.provider_id) return fail("Provider not found.");

  const { data: provider } = await createAdminClient()
    .from("providers")
    .select("id, name, api_url, api_key")
    .eq("id", order.provider_id)
    .single();
  if (!provider) return fail("Provider not found.");

  try {
    await providerApi.refill(provider, order.provider_order_id);
  } catch (err) {
    return fail((err as Error).message);
  }

  await createAdminClient().from("orders").update({ refill_count: (order.refill_count ?? 0) + 1 }).eq("id", orderId);
  await writeLog({
    userId: user.id,
    action: "order_refill",
    entityType: "orders",
    entityId: order.id,
    description: `Refilled order #${order.order_number}`,
  });
  return ok(undefined, "Refill requested successfully.");
}

export async function retryOrderAction(
  orderId: string,
  link: string
): Promise<ActionResult<{ orderId: string; orderNumber: string }>> {
  const headerStore = await headers();
  const ip = getClientIp(headerStore);

  const { user, error } = await requireUser();
  if (error || !user) return fail(error ?? "Not authenticated");
  if (!user) return fail("Not authenticated");

  const limited = await rateLimit(`order:${user.id}`, 20, 60);
  if (!limited.success) {
    return fail("You are creating orders too quickly. Please wait a moment.");
  }

  const parsed = retryOrderSchema.safeParse({ orderId, link });
  if (!parsed.success) {
    return fail(parsed.error.errors[0]?.message ?? "Invalid retry data");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, user_id, status, service_id, quantity, order_number")
    .eq("id", parsed.data.orderId)
    .single();

  if (!order) return fail("Order not found.");
  if (order.user_id !== user.id && !isAdminProfile(user)) return fail("Forbidden.");
  if (order.status !== "failed" && order.status !== "rejected") {
    return fail("Only failed orders can be retried.");
  }
  if (!order.service_id) return fail("Original order has no service.");

  // Create a brand-new order through the shared creation path (same service and
  // quantity, new link). The original failed order row is left untouched.
  const result = await placeOrder({
    user,
    serviceId: order.service_id,
    quantity: order.quantity,
    link: parsed.data.link,
    ip,
    userAgent: headerStore.get("user-agent"),
  });

  if (result.success && result.data) {
    await writeLog({
      userId: user.id,
      action: "order_retry",
      entityType: "orders",
      entityId: order.id,
      description: `Retried failed order #${order.order_number ?? order.id} by creating a new order #${result.data.orderNumber} with a new link`,
      meta: { original_order_id: order.id, new_order_id: result.data.orderId },
    });
  }

  return result;
}
