"use server";

import { headers } from "next/headers";
import { createOrderSchema } from "@/lib/validations";
import { fail, ok, requireUser, isAdminProfile, type ActionResult } from "@/lib/guards";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { generateOrderNumber, formatUsd } from "@/lib/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { providerApi } from "@/lib/provider/smmfollow";
import { computeOrderCharge, round2 } from "@/lib/pricing";
import { writeLog } from "@/lib/audit";
import { createNotification } from "@/lib/notify";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, Order, OrderStatus } from "@/lib/types/database";

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

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id, name, category_id, provider_id, provider_service_id, price, min_quantity, max_quantity, type, is_active")
    .eq("id", parsed.data.serviceId)
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

  const qty = parsed.data.quantity;
  if (qty < service.min_quantity || qty > service.max_quantity) {
    return fail(
      `Quantity must be between ${service.min_quantity} and ${service.max_quantity} for this service.`
    );
  }

  // `services.price` is the retail price per 1000 units (same as the provider
  // rate + markup), so the charge is (price/1000) x quantity - never price x quantity.
  let price = computeOrderCharge(service.price, qty);
  let couponDiscount = 0;

  // Optional coupon
  if (parsed.data.coupon && parsed.data.coupon.trim().length > 0) {
    const { data: coupon, error: couponError } = await supabase.rpc("get_coupon", {
      p_code: parsed.data.coupon.trim(),
    });
    if (couponError || !coupon) {
      return fail("Invalid or expired coupon.");
    }
    if (coupon.min_amount && price < coupon.min_amount) {
      return fail(`Coupon requires a minimum order of ${coupon.min_amount} ${user.currency}.`);
    }
    const perUserUsed = await checkCouponUsage(user.id, coupon.id);
    if (perUserUsed >= (coupon.per_user_limit ?? 1)) {
      return fail("Coupon usage limit reached for your account.");
    }
    if (coupon.discount_type === "percent") {
      couponDiscount = round2((price * coupon.discount_value) / 100);
      if (coupon.max_discount) couponDiscount = Math.min(couponDiscount, coupon.max_discount);
    } else {
      couponDiscount = Math.min(coupon.discount_value, price);
    }
    price = round2(Math.max(price - couponDiscount, 0));
  }

  if (user.balance < price) {
    return fail(
      `Insufficient balance. You need ${price.toLocaleString()} ${user.currency} but have ${user.balance.toLocaleString()} ${user.currency}.`
    );
  }

  const orderNumber = generateOrderNumber();

  // 1. Create order (pending, not yet charged)
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      user_id: user.id,
      service_id: service.id,
      provider_id: service.provider_id,
      link: parsed.data.link,
      quantity: qty,
      price,
      status: "pending",
      currency: user.currency,
    })
    .select("*")
    .single();

  if (orderError || !order) {
    return fail("Failed to create order. Please try again.");
  }

  // 2. Charge the user atomically
  const { data: charged, error: chargeError } = await supabase.rpc("deduct_order_cost", {
    p_order_id: order.id,
    p_user_id: user.id,
  });

  if (chargeError || !charged) {
    await supabase.from("orders").update({ status: "rejected", error_message: "Balance check failed." }).eq("id", order.id);
    await createNotification({
      userId: user.id,
      type: "order_status",
      title: "Order failed",
      body: `Order #${orderNumber} could not be charged.`,
      link: "/orders",
    });
    return fail("Insufficient balance at charge time. Order cancelled.");
  }

  // 2b. Record coupon usage so usage limits are enforced. Best-effort: a
  // bookkeeping failure here must not abort the order after the charge has
  // been applied, which would leave the order stuck in "pending".
  if (couponDiscount > 0 && parsed.data.coupon) {
    try {
      const { data: coupon } = await supabase
        .from("coupons")
        .select("id")
        .eq("code", parsed.data.coupon.trim())
        .maybeSingle();
      if (coupon) {
        await supabase.rpc("use_coupon", {
          p_user_id: user.id,
          p_coupon_id: coupon.id,
          p_balance_after: user.balance - price,
          p_currency: user.currency,
          p_description: `Coupon discount applied (${parsed.data.coupon.trim()})`,
        });
      }
    } catch {
      // Non-fatal: coupon usage tracking failed, order still proceeds.
    }
  }

  // 3. Submit to provider
  // Provider credentials (api_url, api_key) are protected by RLS and only
  // readable by admins via the user-scoped client, so read them with the
  // service-role client. This block runs server-side only. Any failure in the
  // lookup or the API call (including a missing service-role key) is recorded
  // on the order instead of leaving it stuck in "pending" with no provider
  // reference, and we never mark it submitted until the provider returns an id.
  let providerOrderId: string | null = null;
  let providerResponse: unknown = null;
  let providerName: string | null = null;
  let status: OrderStatus = "processing";

  try {
    const admin = createAdminClient();
    const { data: provider, error: providerError } = await admin
      .from("providers")
      .select("id, name, api_url, api_key, status")
      .eq("id", service.provider_id)
      .single();

    if (providerError) {
      status = "failed";
      providerResponse = { error: `Provider lookup failed: ${providerError.message}` };
    } else if (!provider) {
      status = "failed";
      providerResponse = { error: "Provider missing" };
    } else if (provider.status !== "active") {
      status = "failed";
      providerResponse = { error: `Provider "${provider.name}" is not active.` };
    } else {
      const result = await providerApi.createOrder(provider, {
        service: Number(service.provider_service_id),
        link: parsed.data.link,
        quantity: qty,
      });
      providerOrderId = String(result.order);
      providerName = provider.name;
      providerResponse = {
        provider_id: provider.id,
        provider_name: provider.name,
        provider_order_id: providerOrderId,
        ...result,
      };
    }
  } catch (err) {
    status = "failed";
    providerResponse = { error: (err as Error).message };
  }

  // 4. Persist the provider reference atomically with the status. The
  // user-scoped client can fail an update OR silently match 0 rows (RLS
  // filtering returns 200 with no error), so every write is verified to have
  // actually changed the row. On failure or no-op, retry with the service-role
  // client, which bypasses RLS and is the authoritative writer. This guarantees
  // an order the provider accepted is never left stuck in "pending" without
  // its provider_order_id.
  const updates = {
    provider_order_id: providerOrderId,
    provider_id: service.provider_id,
    provider_response: providerResponse as never,
    status,
    error_message: status === "failed" ? String((providerResponse as { error?: string })?.error ?? "Unknown error") : null,
  };
  let updateError: { message: string } | null = null;
  const firstWrite = await updateOrderVerified(supabase, order.id, updates);
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
    userAgent: headerStore.get("user-agent"),
    meta: {
      price,
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

async function checkCouponUsage(userId: string, couponId: string): Promise<number> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("reference_type", "coupon")
    .eq("reference_id", couponId);
  return data?.length ?? 0;
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
  if (!order.provider_order_id) {
    // Not yet submitted: mark cancelled then refund atomically
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", orderId);
    await supabase.rpc("refund_order", { p_order_id: orderId, p_refunded_by: user.id });
    await createNotification({
      userId: user.id,
      type: "order_cancelled",
      title: "Order cancelled",
      body: `Order #${order.order_number} was cancelled. ${formatUsd(order.price)} refunded.`,
      link: `/orders/${order.id}`,
    });
    return ok(undefined, "Order cancelled and refunded.");
  }

  let provider: { id: string; name: string; api_url: string; api_key: string } | null = null;
  if (order.provider_id) {
    const { data: p } = await createAdminClient()
      .from("providers")
      .select("id, name, api_url, api_key")
      .eq("id", order.provider_id)
      .single();
    provider = p;
  }

  if (provider) {
    try {
      await providerApi.cancel(provider, order.provider_order_id);
    } catch {
      // Best-effort cancellation
    }
  }

  await supabase.from("orders").update({ status: "cancelled" }).eq("id", orderId);
  const { error: refundError } = await supabase.rpc("refund_order", {
    p_order_id: orderId,
    p_refunded_by: user.id,
  });

  await createNotification({
    userId: user.id,
    type: "order_cancelled",
    title: "Order cancelled",
    body: refundError
      ? `Order #${order.order_number} was cancelled but refund failed: ${refundError.message}. Contact support.`
      : `Order #${order.order_number} was cancelled. ${formatUsd(order.price)} refunded.`,
    link: `/orders/${order.id}`,
  });

  await writeLog({
    userId: user.id,
    action: "order_cancel",
    entityType: "orders",
    entityId: order.id,
    description: `Cancelled order #${order.order_number}`,
  });

  return ok(undefined, "Order cancelled and refunded.");
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
    const firstWrite = await updateOrderVerified(supabase, orderId, updates);
    if (!firstWrite.ok) {
      const retryWrite = await updateOrderVerified(createAdminClient(), orderId, updates);
      if (!retryWrite.ok) {
        return fail(
          `Provider reported "${result.status}" but saving it failed: ${retryWrite.error?.message ?? "unknown error"}`
        );
      }
    }
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

  await supabase.from("orders").update({ refill_count: (order.refill_count ?? 0) + 1 }).eq("id", orderId);
  await writeLog({
    userId: user.id,
    action: "order_refill",
    entityType: "orders",
    entityId: order.id,
    description: `Refilled order #${order.order_number}`,
  });
  return ok(undefined, "Refill requested successfully.");
}

export async function retryFailedOrderAction(orderId: string): Promise<ActionResult> {
  const { user, error } = await requireUser();
  if (error || !user) return fail(error ?? "Not authenticated");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, user_id, status, provider_id, service_id, order_number, link, quantity, services(provider_service_id)")
    .eq("id", orderId)
    .single();

  if (!order) return fail("Order not found.");
  if (order.user_id !== user.id && !isAdminProfile(user)) return fail("Forbidden.");
  if (order.status !== "failed" && order.status !== "rejected") {
    return fail("Only failed orders can be retried.");
  }
  if (!order.provider_id) return fail("Provider not found.");

  const { data: provider } = await createAdminClient()
    .from("providers")
    .select("id, name, api_url, api_key")
    .eq("id", order.provider_id)
    .single();
  if (!provider) return fail("Provider not found.");

  try {
    const result = await providerApi.createOrder(provider, {
      service: Number(order.services?.provider_service_id),
      link: order.link,
      quantity: order.quantity,
    });
    const updates = {
      status: "processing" as OrderStatus,
      provider_order_id: String(result.order),
      provider_response: result as never,
      error_message: null,
    };
    const firstWrite = await updateOrderVerified(supabase, orderId, updates);
    if (!firstWrite.ok) {
      const retryWrite = await updateOrderVerified(createAdminClient(), orderId, updates);
      if (!retryWrite.ok) {
        throw new Error(
          `Provider accepted the order but saving the reference failed: ${retryWrite.error?.message ?? "unknown error"}`
        );
      }
    }
    await writeLog({
      userId: user.id,
      action: "order_retry",
      entityType: "orders",
      entityId: order.id,
      description: `Retried order #${order.order_number ?? order.id}`,
    });
    return ok(undefined, "Order retried successfully.");
  } catch (err) {
    return fail((err as Error).message);
  }
}
